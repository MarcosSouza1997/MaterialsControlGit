-- ============================================================================
-- MATERIALS CONTROL v1.0 — schema.sql (Supabase / PostgreSQL 15+)
-- ----------------------------------------------------------------------------
-- COMO USAR
--   1. Supabase → SQL Editor → New query → colar TUDO → Run.
--   2. Roda numa transação única: se algum comando falhar, NADA é aplicado
--      e você pode corrigir e rodar de novo.
--   3. Para recomeçar do zero depois de ter dado certo, use o bloco RESET no
--      final do arquivo (comentado).
--
-- Segue: spec/spec.md (regras RN-01..RN-15) e o "Contrato do banco" do
-- spec/tasks.md (nomes de tabelas, views e funções usados pelo front).
--
-- SEGURANÇA
--   * RLS ligada em todas as tabelas. O front só ESCREVE em items (insert/update
--     por almoxarife/gestor). Todo o resto muda por funções (RPC) abaixo.
--   * Views usam security_invoker: respeitam a RLS de quem consulta.
--   * O papel anônimo (anon) não tem acesso a nada.
-- ============================================================================
begin;

-- ============================================================================
-- 1. TIPOS
-- ============================================================================
create type public.user_role      as enum ('solicitante', 'almoxarife', 'gestor_ti', 'diretoria');
create type public.item_category  as enum ('PAPELARIA', 'INFORMATICA', 'LIMPEZA', 'IMPRESSAO', 'OUTROS');
create type public.item_type      as enum ('consumivel', 'permanente');
create type public.request_status as enum ('PENDENTE', 'APROVADO', 'EM_SEPARACAO', 'ENTREGUE', 'REJEITADO', 'CANCELADO');
create type public.movement_type  as enum ('ENTRADA', 'SAIDA', 'AJUSTE', 'DESCARTE');
create type public.audit_action   as enum ('INSERT', 'UPDATE', 'DELETE');

-- ============================================================================
-- 2. PARÂMETROS E UTILITÁRIOS
-- ============================================================================
-- Constantes do sistema (spec, seção 5 "Parâmetros")
create function public.app_param(p text)
returns numeric language sql immutable as $$
  select (case p
    when 'approval_limit'       then 200   -- RN-04: alçada do almoxarife (R$)
    when 'recent_delivery_days' then 180   -- RN-02: janela de aviso de recebimento recente
    when 'expiry_alert_days'    then 60    -- RN-11: alerta de validade próxima
    when 'stale_lot_days'       then 120   -- RN-11: lote parado
  end)::numeric
$$;

-- Data de hoje no fuso de Brasília (o servidor roda em UTC)
create function public.today_br()
returns date language sql stable as $$
  select (now() at time zone 'America/Sao_Paulo')::date
$$;

-- ============================================================================
-- 3. TABELAS
-- ============================================================================

-- 3.1 Perfis (um por usuário do Auth). Conta nova nasce INATIVA (RN-13).
create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text not null check (char_length(full_name) between 2 and 120),
  role        public.user_role not null default 'solicitante',
  cost_center text,
  active      boolean not null default false,
  created_at  timestamptz not null default now()
);

-- 3.2 Itens do catálogo (nunca são excluídos, só desativados — RN-14)
create table public.items (
  id              uuid primary key default gen_random_uuid(),
  name            text not null unique check (char_length(name) between 2 and 120),
  sku             text not null unique check (char_length(sku) between 2 and 40),
  description     text,
  image_url       text,
  category        public.item_category not null default 'OUTROS',
  unit            text not null default 'un' check (unit in ('un', 'cx', 'pct', 'rl', 'lt', 'kg')),
  type            public.item_type not null,
  location        text,
  reorder_point   integer not null default 0 check (reorder_point >= 0),
  requires_expiry boolean not null default false,
  unit_price      numeric(10,2) check (unit_price is null or unit_price >= 0),
  active          boolean not null default true,
  created_at      timestamptz not null default now(),
  -- RN-15: preço obrigatório para item permanente (base da alçada)
  constraint permanent_needs_price check (type <> 'permanente' or unit_price is not null)
);

-- 3.3 Saldo total por item (mantido por trigger; nunca escrito pelo front)
create table public.stock (
  item_id    uuid primary key references public.items(id),
  quantity   integer not null default 0 check (quantity >= 0),
  updated_at timestamptz not null default now()
);

-- 3.4 Lotes (toda entrada gera um lote; validade só nos itens que exigem)
create table public.batches (
  id                 uuid primary key default gen_random_uuid(),
  item_id            uuid not null references public.items(id),
  lot_number         text,
  expires_on         date,
  quantity_received  integer not null check (quantity_received > 0),
  quantity_remaining integer not null check (quantity_remaining >= 0),
  supplier           text,
  invoice_number     text,
  received_at        timestamptz not null default now(),
  received_by        uuid references public.profiles(id),   -- nulo apenas nos dados de demonstração
  constraint remaining_within_received check (quantity_remaining <= quantity_received)
);
create index batches_item_idx on public.batches (item_id, expires_on);

-- 3.5 Pedidos (um pedido por item)
create table public.requests (
  id            uuid primary key default gen_random_uuid(),
  requester_id  uuid not null references public.profiles(id),
  item_id       uuid not null references public.items(id),
  quantity      integer not null check (quantity > 0),
  justification text not null check (char_length(trim(justification)) >= 10),
  cost_center   text,
  status        public.request_status not null default 'PENDENTE',
  auto_approved boolean not null default false,
  approved_by   uuid references public.profiles(id),
  approved_at   timestamptz,
  reject_reason text,
  delivered_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint reject_needs_reason check (status <> 'REJEITADO' or (reject_reason is not null and char_length(trim(reject_reason)) > 0))
);
-- RN-01: um só pedido ativo por (solicitante, item), garantido pelo banco
create unique index unique_active_request_per_item
  on public.requests (requester_id, item_id)
  where status in ('PENDENTE', 'APROVADO', 'EM_SEPARACAO');
create index requests_status_idx    on public.requests (status);
create index requests_requester_idx on public.requests (requester_id, created_at desc);
create index requests_item_idx      on public.requests (item_id, status);

-- 3.6 Movimentações de estoque (imutáveis — RN-07)
create table public.stock_movements (
  id           uuid primary key default gen_random_uuid(),
  item_id      uuid not null references public.items(id),
  batch_id     uuid references public.batches(id),
  type         public.movement_type not null,
  quantity     integer not null check (quantity <> 0),      -- com sinal: + entra, − sai
  request_id   uuid references public.requests(id),
  note         text,
  performed_by uuid references public.profiles(id),         -- nulo apenas nos dados de demonstração
  created_at   timestamptz not null default now(),
  constraint saida_exige_pedido    check (type <> 'SAIDA' or request_id is not null),
  constraint sinal_da_quantidade   check (
        (type = 'ENTRADA' and quantity > 0)
     or (type in ('SAIDA', 'DESCARTE') and quantity < 0)
     or (type = 'AJUSTE')),
  constraint motivo_obrigatorio    check (type not in ('AJUSTE', 'DESCARTE') or (note is not null and char_length(trim(note)) > 0))
);
create index movements_item_idx    on public.stock_movements (item_id, created_at desc);
create index movements_request_idx on public.stock_movements (request_id);
create index movements_created_idx on public.stock_movements (created_at desc);

-- 3.7 Auditoria (append-only — RN-12)
create table public.audit_log (
  id         bigint generated always as identity primary key,
  table_name text not null,
  record_id  uuid,
  action     public.audit_action not null,
  old_data   jsonb,
  new_data   jsonb,
  changed_by uuid,
  changed_at timestamptz not null default now()
);
create index audit_table_idx on public.audit_log (table_name, changed_at desc);
create index audit_user_idx  on public.audit_log (changed_by, changed_at desc);

-- ============================================================================
-- 4. FUNÇÕES AUXILIARES DE PERFIL (usadas pelas policies e pelas RPCs)
-- ============================================================================
create function public.is_active_user()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and active)
$$;

create function public.has_role(p public.user_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and active and role = p)
$$;

-- almoxarife OU gestor_ti (gestor_ti herda tudo do almoxarife)
create function public.is_stock_manager()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles
                 where id = auth.uid() and active and role in ('almoxarife', 'gestor_ti'))
$$;

-- almoxarife, gestor_ti ou diretoria
create function public.is_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles
                 where id = auth.uid() and active and role in ('almoxarife', 'gestor_ti', 'diretoria'))
$$;

-- ============================================================================
-- 5. TRIGGERS
-- ============================================================================

-- 5.1 Cria o perfil (INATIVO, solicitante) quando alguém se cadastra (RN-13)
create function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_name text;
begin
  v_name := left(coalesce(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
                          nullif(split_part(new.email, '@', 1), ''),
                          'Usuário'), 120);
  if char_length(v_name) < 2 then v_name := 'Usuário ' || v_name; end if;
  insert into public.profiles (id, full_name, role, active)
  values (new.id, v_name, 'solicitante', false);
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 5.2 Mantém o saldo total (stock) a partir das movimentações (RN-07)
create function public.apply_stock_movement()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_current integer;
begin
  select quantity into v_current from public.stock where item_id = new.item_id for update;
  v_current := coalesce(v_current, 0);
  if v_current + new.quantity < 0 then
    raise exception 'Estoque insuficiente: saldo %, movimento %', v_current, new.quantity;
  end if;
  insert into public.stock (item_id, quantity)
  values (new.item_id, v_current + new.quantity)
  on conflict (item_id) do update
    set quantity = excluded.quantity, updated_at = now();
  return new;
end $$;

create trigger trg_apply_movement
  after insert on public.stock_movements
  for each row execute function public.apply_stock_movement();

-- 5.3 Impede editar/apagar movimentações e auditoria, para qualquer usuário (RN-07, RN-12)
create function public.prevent_mutation()
returns trigger language plpgsql as $$
begin
  raise exception 'Registro imutável: % não aceita alteração nem exclusão', tg_table_name;
end $$;

create trigger trg_movements_immutable
  before update or delete on public.stock_movements
  for each row execute function public.prevent_mutation();
create trigger trg_movements_no_truncate
  before truncate on public.stock_movements
  for each statement execute function public.prevent_mutation();
create trigger trg_audit_immutable
  before update or delete on public.audit_log
  for each row execute function public.prevent_mutation();
create trigger trg_audit_no_truncate
  before truncate on public.audit_log
  for each statement execute function public.prevent_mutation();

-- 5.4 Só transições de status válidas (RN-05)
create function public.enforce_request_transition()
returns trigger language plpgsql as $$
begin
  if new.status = old.status then
    return new;
  end if;
  if (old.status = 'PENDENTE'     and new.status in ('APROVADO', 'REJEITADO', 'CANCELADO'))
  or (old.status = 'APROVADO'     and new.status = 'EM_SEPARACAO')
  or (old.status = 'EM_SEPARACAO' and new.status = 'ENTREGUE') then
    return new;
  end if;
  raise exception 'Transição de status não permitida: % → %', old.status, new.status;
end $$;

create trigger trg_requests_transition
  before update on public.requests
  for each row execute function public.enforce_request_transition();

create function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger trg_requests_touch
  before update on public.requests
  for each row execute function public.touch_updated_at();

-- 5.5 Auditoria de itens, pedidos, movimentações e perfis (RN-12)
create function public.audit_trigger()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    insert into public.audit_log (table_name, record_id, action, new_data, changed_by)
    values (tg_table_name, new.id, 'INSERT', to_jsonb(new), auth.uid());
    return new;
  elsif tg_op = 'UPDATE' then
    insert into public.audit_log (table_name, record_id, action, old_data, new_data, changed_by)
    values (tg_table_name, new.id, 'UPDATE', to_jsonb(old), to_jsonb(new), auth.uid());
    return new;
  else
    insert into public.audit_log (table_name, record_id, action, old_data, changed_by)
    values (tg_table_name, old.id, 'DELETE', to_jsonb(old), auth.uid());
    return old;
  end if;
end $$;

create trigger trg_audit_profiles  after insert or update or delete on public.profiles        for each row execute function public.audit_trigger();
create trigger trg_audit_items     after insert or update or delete on public.items           for each row execute function public.audit_trigger();
create trigger trg_audit_requests  after insert or update or delete on public.requests        for each row execute function public.audit_trigger();
create trigger trg_audit_movements after insert                     on public.stock_movements for each row execute function public.audit_trigger();

-- ============================================================================
-- 6. ROW LEVEL SECURITY
-- ============================================================================
alter table public.profiles        enable row level security;
alter table public.items           enable row level security;
alter table public.stock           enable row level security;
alter table public.batches         enable row level security;
alter table public.requests        enable row level security;
alter table public.stock_movements enable row level security;
alter table public.audit_log       enable row level security;

-- profiles: cada um lê o próprio (mesmo inativo); a equipe lê todos. Sem escrita direta.
create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_staff());

-- items: leitura para usuários ativos; escrita só almoxarife/gestor_ti
create policy items_select on public.items for select to authenticated
  using (public.is_active_user());
create policy items_insert on public.items for insert to authenticated
  with check (public.is_stock_manager());
create policy items_update on public.items for update to authenticated
  using (public.is_stock_manager()) with check (public.is_stock_manager());

-- stock e batches: leitura para usuários ativos; escrita só pelas funções (definer)
create policy stock_select   on public.stock   for select to authenticated using (public.is_active_user());
create policy batches_select on public.batches for select to authenticated using (public.is_active_user());

-- requests: o solicitante vê os seus; a equipe vê todos. Escrita só pelas funções.
create policy requests_select on public.requests for select to authenticated
  using (public.is_active_user() and (requester_id = auth.uid() or public.is_staff()));

-- stock_movements: leitura para almoxarife, gestor_ti e diretoria
create policy movements_select on public.stock_movements for select to authenticated
  using (public.is_stock_manager() or public.has_role('diretoria'));

-- audit_log: leitura para gestor_ti e diretoria
create policy audit_select on public.audit_log for select to authenticated
  using (public.has_role('gestor_ti') or public.has_role('diretoria'));

-- ============================================================================
-- 7. VIEWS (security_invoker: respeitam a RLS de quem consulta)
-- ============================================================================

-- 7.1 Pedidos com dados do item e do solicitante
create view public.vw_requests with (security_invoker = true) as
select r.*,
       i.name  as item_name,
       i.sku   as item_sku,
       i.unit  as item_unit,
       i.type  as item_type,
       i.unit_price,
       coalesce(i.unit_price, 0) * r.quantity as total_value,
       p.full_name   as requester_name,
       p.cost_center as requester_cost_center
from public.requests r
join public.items i on i.id = r.item_id
left join public.profiles p on p.id = r.requester_id;

-- 7.2 Visão geral de estoque (saldo físico x saldo disponível = lotes não vencidos)
create view public.vw_stock_overview with (security_invoker = true) as
select i.*,
       coalesce(s.quantity, 0)            as quantity,
       coalesce(av.qty, 0)::integer       as available_quantity,
       case
         when coalesce(av.qty, 0) = 0 then 'SEM_ESTOQUE'
         when i.reorder_point > 0 and coalesce(av.qty, 0) <= i.reorder_point then 'ABAIXO_MINIMO'
         else 'NORMAL'
       end                                as stock_status,
       nx.next_expiry,
       coalesce(rk.cnt, 0)::integer       as at_risk_batches
from public.items i
left join public.stock s on s.item_id = i.id
left join lateral (
  select sum(b.quantity_remaining) as qty
  from public.batches b
  where b.item_id = i.id
    and (b.expires_on is null or b.expires_on >= public.today_br())
) av on true
left join lateral (
  select min(b.expires_on) as next_expiry
  from public.batches b
  where b.item_id = i.id and b.quantity_remaining > 0 and b.expires_on >= public.today_br()
) nx on true
left join lateral (
  select count(*) as cnt
  from public.batches b
  where b.item_id = i.id and b.quantity_remaining > 0
    and (   b.expires_on <= public.today_br() + public.app_param('expiry_alert_days')::int
         or (i.requires_expiry
             and b.received_at < now() - make_interval(days => public.app_param('stale_lot_days')::int)))
) rk on true;

-- 7.3 Alertas (RN-11). "days": ESTOQUE_BAIXO = nulo · VALIDADE_PROXIMA = dias até vencer
--     VENCIDO = dias de atraso · LOTE_PARADO = dias em estoque
create view public.vw_alerts with (security_invoker = true) as
select 'ESTOQUE_BAIXO'::text as alert_type,
       o.id as item_id, o.name as item_name, o.sku,
       null::uuid as batch_id, null::text as lot_number,
       o.available_quantity as quantity, o.reorder_point as threshold,
       null::date as expires_on, null::timestamptz as received_at, null::integer as days
from public.vw_stock_overview o
where o.active and o.reorder_point > 0 and o.available_quantity <= o.reorder_point
union all
select 'VALIDADE_PROXIMA', i.id, i.name, i.sku, b.id, b.lot_number,
       b.quantity_remaining, null::integer, b.expires_on, b.received_at,
       (b.expires_on - public.today_br())
from public.batches b join public.items i on i.id = b.item_id
where i.active and b.quantity_remaining > 0 and b.expires_on is not null
  and b.expires_on >= public.today_br()
  and b.expires_on <= public.today_br() + public.app_param('expiry_alert_days')::int
union all
select 'VENCIDO', i.id, i.name, i.sku, b.id, b.lot_number,
       b.quantity_remaining, null::integer, b.expires_on, b.received_at,
       (public.today_br() - b.expires_on)
from public.batches b join public.items i on i.id = b.item_id
where i.active and b.quantity_remaining > 0 and b.expires_on is not null
  and b.expires_on < public.today_br()
union all
select 'LOTE_PARADO', i.id, i.name, i.sku, b.id, b.lot_number,
       b.quantity_remaining, null::integer, b.expires_on, b.received_at,
       (public.today_br() - (b.received_at at time zone 'America/Sao_Paulo')::date)
from public.batches b join public.items i on i.id = b.item_id
where i.active and i.requires_expiry and b.quantity_remaining > 0
  and (b.expires_on is null or b.expires_on >= public.today_br())
  and b.received_at < now() - make_interval(days => public.app_param('stale_lot_days')::int);

-- 7.4 Histórico de entregas por solicitante e item (RN-02)
create view public.vw_delivery_history with (security_invoker = true) as
select r.requester_id, r.item_id,
       i.name as item_name, i.sku as item_sku,
       r.delivered_at,
       (public.today_br() - (r.delivered_at at time zone 'America/Sao_Paulo')::date) as days_ago
from public.requests r
join public.items i on i.id = r.item_id
where r.status = 'ENTREGUE' and r.delivered_at is not null;

-- 7.5 Fila de aprovação (RN-04). my_turn: gestor_ti decide qualquer valor;
--     almoxarife decide até o limite; demais perfis nunca.
--     recent_delivery_days só para item permanente (RN-02).
create view public.vw_approval_queue with (security_invoker = true) as
select q.*,
       coalesce(av.qty, 0)::integer as stock_quantity,
       case when q.item_type = 'permanente' then
         (select public.today_br() - max((h.delivered_at at time zone 'America/Sao_Paulo')::date)
            from public.requests h
           where h.requester_id = q.requester_id
             and h.item_id = q.item_id
             and h.status = 'ENTREGUE'
             and h.delivered_at >= now() - make_interval(days => public.app_param('recent_delivery_days')::int))
       end as recent_delivery_days,
       case
         when public.has_role('gestor_ti')  then true
         when public.has_role('almoxarife') then q.total_value <= public.app_param('approval_limit')
         else false
       end as my_turn
from public.vw_requests q
left join lateral (
  select sum(b.quantity_remaining) as qty
  from public.batches b
  where b.item_id = q.item_id
    and (b.expires_on is null or b.expires_on >= public.today_br())
) av on true
where q.status = 'PENDENTE';

-- 7.6 Movimentações com nomes
create view public.vw_movements with (security_invoker = true) as
select m.id, m.item_id, i.name as item_name, i.sku,
       m.batch_id, b.lot_number,
       m.type, m.quantity, m.request_id, m.note,
       m.performed_by, p.full_name as performer_name,
       m.created_at
from public.stock_movements m
join public.items i on i.id = m.item_id
left join public.batches b on b.id = m.batch_id
left join public.profiles p on p.id = m.performed_by;

-- 7.7 Consumo (uma linha por saída para colaborador) — relatórios e gráfico
create view public.vw_consumption with (security_invoker = true) as
select m.created_at as moved_at,
       date_trunc('month', m.created_at at time zone 'America/Sao_Paulo')::date as month,
       m.item_id, i.name as item_name, i.sku, i.category,
       r.requester_id, p.full_name as requester_name, r.cost_center,
       (-m.quantity) as quantity,
       (-m.quantity) * coalesce(i.unit_price, 0) as value
from public.stock_movements m
join public.items i on i.id = m.item_id
left join public.requests r on r.id = m.request_id
left join public.profiles p on p.id = r.requester_id
where m.type = 'SAIDA';

-- 7.8 Auditoria com nome do usuário
create view public.vw_audit with (security_invoker = true) as
select a.id, a.table_name, a.record_id, a.action, a.old_data, a.new_data,
       a.changed_by, p.full_name as user_name, a.changed_at
from public.audit_log a
left join public.profiles p on p.id = a.changed_by;

-- ============================================================================
-- 8. FUNÇÕES (RPC) — toda mudança de estado passa por aqui
-- ============================================================================

-- 8.1 Cria um pedido por item, atomicamente (RN-01, RN-03, RN-09)
--     p_items: [{"item_id":"<uuid>","quantity":2}, ...]
create function public.create_requests(p_items jsonb, p_justification text, p_cost_center text)
returns setof public.requests
language plpgsql security definer set search_path = public as $$
declare
  v_uid   uuid := auth.uid();
  v_elem  jsonb;
  v_item  public.items%rowtype;
  v_qty   integer;
  v_avail integer;
  v_req   public.requests%rowtype;
  v_auto  boolean;
begin
  if not (public.has_role('solicitante') or public.is_stock_manager()) then
    raise exception 'Seu perfil não pode criar pedidos' using errcode = '42501';
  end if;
  if p_justification is null or char_length(trim(p_justification)) < 10 then
    raise exception 'A justificativa deve ter pelo menos 10 caracteres';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Nenhum item informado';
  end if;

  for v_elem in select * from jsonb_array_elements(p_items) loop
    v_qty := (v_elem ->> 'quantity')::integer;
    if v_qty is null or v_qty <= 0 then
      raise exception 'A quantidade deve ser maior que zero';
    end if;

    select * into v_item from public.items
     where id = (v_elem ->> 'item_id')::uuid and active;
    if not found then
      raise exception 'Item não encontrado ou inativo';
    end if;

    select coalesce(sum(quantity_remaining), 0)::integer into v_avail
      from public.batches
     where item_id = v_item.id
       and (expires_on is null or expires_on >= public.today_br());
    if v_qty > v_avail then
      raise exception 'Quantidade acima do saldo disponível de "%": saldo %, pedido %',
        v_item.name, v_avail, v_qty;
    end if;

    v_auto := (v_item.type = 'consumivel');     -- RN-03: consumível é aprovado pelo sistema

    begin
      insert into public.requests
        (requester_id, item_id, quantity, justification, cost_center, status, auto_approved, approved_at)
      values
        (v_uid, v_item.id, v_qty, trim(p_justification), nullif(trim(p_cost_center), ''),
         case when v_auto then 'APROVADO'::public.request_status else 'PENDENTE'::public.request_status end,
         v_auto,
         case when v_auto then now() end)
      returning * into v_req;
    exception when unique_violation then
      raise exception 'Você já possui um pedido ativo deste item: %', v_item.name
        using errcode = '23505';
    end;

    return next v_req;
  end loop;
  return;
end $$;

-- 8.2 Aprovar (RN-04: acima do limite, só gestor_ti)
create function public.approve_request(p_request_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare r public.requests%rowtype; v_total numeric;
begin
  if not public.is_stock_manager() then
    raise exception 'Você não tem permissão para aprovar pedidos' using errcode = '42501';
  end if;
  select * into r from public.requests where id = p_request_id for update;
  if not found then raise exception 'Pedido não encontrado'; end if;
  if r.status <> 'PENDENTE' then
    raise exception 'O pedido não está pendente (status atual: %)', r.status;
  end if;
  select coalesce(i.unit_price, 0) * r.quantity into v_total from public.items i where i.id = r.item_id;
  if v_total > public.app_param('approval_limit') and not public.has_role('gestor_ti') then
    raise exception 'Pedidos acima de R$ % só podem ser aprovados pelo gestor de TI',
      replace(to_char(public.app_param('approval_limit'), 'FM999990.00'), '.', ',');
  end if;
  update public.requests
     set status = 'APROVADO', approved_by = auth.uid(), approved_at = now()
   where id = p_request_id;
end $$;

-- 8.3 Rejeitar (motivo obrigatório — RN-06)
create function public.reject_request(p_request_id uuid, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare r public.requests%rowtype; v_total numeric;
begin
  if not public.is_stock_manager() then
    raise exception 'Você não tem permissão para rejeitar pedidos' using errcode = '42501';
  end if;
  if p_reason is null or char_length(trim(p_reason)) = 0 then
    raise exception 'Informe o motivo da rejeição';
  end if;
  select * into r from public.requests where id = p_request_id for update;
  if not found then raise exception 'Pedido não encontrado'; end if;
  if r.status <> 'PENDENTE' then
    raise exception 'O pedido não está pendente (status atual: %)', r.status;
  end if;
  select coalesce(i.unit_price, 0) * r.quantity into v_total from public.items i where i.id = r.item_id;
  if v_total > public.app_param('approval_limit') and not public.has_role('gestor_ti') then
    raise exception 'Pedidos acima de R$ % só podem ser decididos pelo gestor de TI',
      replace(to_char(public.app_param('approval_limit'), 'FM999990.00'), '.', ',');
  end if;
  update public.requests
     set status = 'REJEITADO', reject_reason = trim(p_reason),
         approved_by = auth.uid(), approved_at = now()
   where id = p_request_id;
end $$;

-- 8.4 Cancelar (só o próprio solicitante, só pendente — RN-06)
create function public.cancel_request(p_request_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare r public.requests%rowtype;
begin
  select * into r from public.requests where id = p_request_id for update;
  if not found then raise exception 'Pedido não encontrado'; end if;
  if r.requester_id <> auth.uid() then
    raise exception 'Só o próprio solicitante pode cancelar o pedido' using errcode = '42501';
  end if;
  if r.status <> 'PENDENTE' then
    raise exception 'Só é possível cancelar pedidos pendentes (status atual: %)', r.status;
  end if;
  update public.requests set status = 'CANCELADO' where id = p_request_id;
end $$;

-- 8.5 Iniciar separação
create function public.start_separation(p_request_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare r public.requests%rowtype;
begin
  if not public.is_stock_manager() then
    raise exception 'Somente almoxarife/gestor pode separar pedidos' using errcode = '42501';
  end if;
  select * into r from public.requests where id = p_request_id for update;
  if not found then raise exception 'Pedido não encontrado'; end if;
  if r.status <> 'APROVADO' then
    raise exception 'O pedido deve estar APROVADO (status atual: %)', r.status;
  end if;
  update public.requests set status = 'EM_SEPARACAO' where id = p_request_id;
end $$;

-- 8.6 Entregar: baixa o estoque consumindo o lote de vencimento mais próximo (FEFO, RN-10).
--     Lote vencido nunca é entregue. Tudo ou nada.
create function public.deliver_request(p_request_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  r      public.requests%rowtype;
  b      record;
  v_need integer;
  v_take integer;
  v_name text;
begin
  if not public.is_stock_manager() then
    raise exception 'Somente almoxarife/gestor pode entregar pedidos' using errcode = '42501';
  end if;
  select * into r from public.requests where id = p_request_id for update;
  if not found then raise exception 'Pedido não encontrado'; end if;
  if r.status <> 'EM_SEPARACAO' then
    raise exception 'O pedido deve estar EM_SEPARACAO (status atual: %)', r.status;
  end if;

  v_need := r.quantity;
  for b in
    select id, quantity_remaining
      from public.batches
     where item_id = r.item_id
       and quantity_remaining > 0
       and (expires_on is null or expires_on >= public.today_br())
     order by expires_on asc nulls last, received_at asc, id
       for update
  loop
    exit when v_need <= 0;
    v_take := least(b.quantity_remaining, v_need);
    update public.batches set quantity_remaining = quantity_remaining - v_take where id = b.id;
    insert into public.stock_movements (item_id, batch_id, type, quantity, request_id, performed_by)
    values (r.item_id, b.id, 'SAIDA', -v_take, r.id, auth.uid());
    v_need := v_need - v_take;
  end loop;

  if v_need > 0 then
    select name into v_name from public.items where id = r.item_id;
    raise exception 'Saldo insuficiente em lotes válidos de "%": faltam % unidade(s)', v_name, v_need;
  end if;

  update public.requests set status = 'ENTREGUE', delivered_at = now() where id = p_request_id;
end $$;

-- 8.7 Entrada de estoque: cria lote + movimentação (RN-10)
create function public.receive_stock(
  p_item_id    uuid,
  p_quantity   integer,
  p_lot        text default null,
  p_expires_on date default null,
  p_supplier   text default null,
  p_invoice    text default null
)
returns void language plpgsql security definer set search_path = public as $$
declare v_item public.items%rowtype; v_batch uuid;
begin
  if not public.is_stock_manager() then
    raise exception 'Somente almoxarife/gestor pode registrar entrada' using errcode = '42501';
  end if;
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'A quantidade deve ser maior que zero';
  end if;
  select * into v_item from public.items where id = p_item_id and active;
  if not found then raise exception 'Item não encontrado ou inativo'; end if;
  if v_item.requires_expiry and p_expires_on is null then
    raise exception 'Este item exige data de validade';
  end if;
  if p_expires_on is not null and p_expires_on < public.today_br() then
    raise exception 'A validade não pode estar no passado';
  end if;

  insert into public.batches
    (item_id, lot_number, expires_on, quantity_received, quantity_remaining, supplier, invoice_number, received_by)
  values
    (p_item_id, nullif(trim(p_lot), ''), p_expires_on, p_quantity, p_quantity,
     nullif(trim(p_supplier), ''), nullif(trim(p_invoice), ''), auth.uid())
  returning id into v_batch;

  insert into public.stock_movements (item_id, batch_id, type, quantity, note, performed_by)
  values (p_item_id, v_batch, 'ENTRADA', p_quantity,
          nullif(concat_ws(' | ', nullif(trim(p_invoice), ''), nullif(trim(p_supplier), '')), ''),
          auth.uid());
end $$;

-- 8.8 Ajuste de inventário: quantidade com sinal, motivo obrigatório (RN-08)
create function public.adjust_stock(p_item_id uuid, p_quantity integer, p_note text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_item  public.items%rowtype;
  v_batch uuid;
  v_need  integer;
  v_total integer;
  v_take  integer;
  b       record;
begin
  if not public.is_stock_manager() then
    raise exception 'Somente almoxarife/gestor pode ajustar o estoque' using errcode = '42501';
  end if;
  if p_quantity is null or p_quantity = 0 then
    raise exception 'A quantidade do ajuste deve ser diferente de zero';
  end if;
  if p_note is null or char_length(trim(p_note)) = 0 then
    raise exception 'Informe o motivo do ajuste';
  end if;
  select * into v_item from public.items where id = p_item_id;
  if not found then raise exception 'Item não encontrado'; end if;

  if p_quantity > 0 then
    if v_item.requires_expiry then
      raise exception 'Itens com validade não aceitam ajuste positivo: use "Registrar entrada"';
    end if;
    insert into public.batches (item_id, lot_number, quantity_received, quantity_remaining, received_by)
    values (p_item_id, 'AJUSTE', p_quantity, p_quantity, auth.uid())
    returning id into v_batch;
    insert into public.stock_movements (item_id, batch_id, type, quantity, note, performed_by)
    values (p_item_id, v_batch, 'AJUSTE', p_quantity, trim(p_note), auth.uid());
  else
    v_need := -p_quantity;
    select coalesce(sum(quantity_remaining), 0)::integer into v_total
      from public.batches where item_id = p_item_id;
    if v_total < v_need then
      raise exception 'Estoque insuficiente para o ajuste: saldo %, ajuste %', v_total, v_need;
    end if;
    for b in
      select id, quantity_remaining
        from public.batches
       where item_id = p_item_id and quantity_remaining > 0
       order by expires_on asc nulls last, received_at asc, id
         for update
    loop
      exit when v_need <= 0;
      v_take := least(b.quantity_remaining, v_need);
      update public.batches set quantity_remaining = quantity_remaining - v_take where id = b.id;
      insert into public.stock_movements (item_id, batch_id, type, quantity, note, performed_by)
      values (p_item_id, b.id, 'AJUSTE', -v_take, trim(p_note), auth.uid());
      v_need := v_need - v_take;
    end loop;
  end if;
end $$;

-- 8.9 Descarte de lote (vencimento, defeito, ressecado)
create function public.discard_batch(p_batch_id uuid, p_quantity integer, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare b public.batches%rowtype;
begin
  if not public.is_stock_manager() then
    raise exception 'Somente almoxarife/gestor pode descartar lotes' using errcode = '42501';
  end if;
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'A quantidade deve ser maior que zero';
  end if;
  if p_reason is null or char_length(trim(p_reason)) = 0 then
    raise exception 'Informe o motivo do descarte';
  end if;
  select * into b from public.batches where id = p_batch_id for update;
  if not found then raise exception 'Lote não encontrado'; end if;
  if p_quantity > b.quantity_remaining then
    raise exception 'Quantidade acima do restante do lote (restam %)', b.quantity_remaining;
  end if;
  update public.batches set quantity_remaining = quantity_remaining - p_quantity where id = p_batch_id;
  insert into public.stock_movements (item_id, batch_id, type, quantity, note, performed_by)
  values (b.item_id, b.id, 'DESCARTE', -p_quantity, trim(p_reason), auth.uid());
end $$;

-- 8.10 Administração de usuários (somente gestor_ti)
create function public.admin_list_users()
returns table (
  id          uuid,
  full_name   text,
  email       text,
  role        public.user_role,
  cost_center text,
  active      boolean,
  created_at  timestamptz
)
language plpgsql security definer set search_path = public as $$
begin
  if not public.has_role('gestor_ti') then
    raise exception 'Somente o gestor de TI pode listar usuários' using errcode = '42501';
  end if;
  return query
    select p.id, p.full_name, u.email::text, p.role, p.cost_center, p.active, p.created_at
      from public.profiles p
      join auth.users u on u.id = p.id
     order by p.active asc, p.created_at desc;
end $$;

create function public.admin_update_profile(
  p_user_id     uuid,
  p_role        text,
  p_cost_center text,
  p_active      boolean
)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.has_role('gestor_ti') then
    raise exception 'Somente o gestor de TI pode alterar usuários' using errcode = '42501';
  end if;
  if p_role is null or p_role not in ('solicitante', 'almoxarife', 'gestor_ti', 'diretoria') then
    raise exception 'Perfil inválido';
  end if;
  if p_active is null then
    raise exception 'Informe se a conta está ativa';
  end if;
  if p_user_id = auth.uid() and (p_role <> 'gestor_ti' or p_active is not true) then
    raise exception 'Você não pode rebaixar nem desativar a si mesmo';
  end if;
  update public.profiles
     set role = p_role::public.user_role,
         cost_center = nullif(trim(p_cost_center), ''),
         active = p_active
   where id = p_user_id;
  if not found then raise exception 'Usuário não encontrado'; end if;
end $$;

-- ============================================================================
-- 9. PERMISSÕES (anon não acessa nada; authenticated só o necessário)
-- ============================================================================
revoke all on all tables    in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke execute on all functions in schema public from public, anon, authenticated;

grant select on public.profiles, public.items, public.stock, public.batches,
                public.requests, public.stock_movements, public.audit_log
  to authenticated;
grant insert, update on public.items to authenticated;

grant select on public.vw_requests, public.vw_stock_overview, public.vw_alerts,
                public.vw_delivery_history, public.vw_approval_queue,
                public.vw_movements, public.vw_consumption, public.vw_audit
  to authenticated;

grant execute on all functions in schema public to authenticated;

-- ============================================================================
-- 10. DADOS DE DEMONSTRAÇÃO (6 itens, lotes e estoque inicial)
--     Inclui de propósito: item abaixo do mínimo (teclado, toner Brother),
--     lote perto de vencer (toner HP), lote vencido (toner HP) e lote parado
--     (toner Brother), para as telas mostrarem estados reais.
-- ============================================================================
insert into public.items
  (name, sku, description, category, unit, type, location, reorder_point, requires_expiry, unit_price) values
  ('Resma de papel A4 75g',          'PAP-A4-75G',    'Resma A4 75g/m², 500 folhas',              'PAPELARIA',   'rl', 'consumivel', 'Palete D-01',              10, false,  28.00),
  ('Cartucho toner HP 85A',          'TON-HP-85A',    'Toner original HP 85A preto',              'IMPRESSAO',   'un', 'consumivel', 'Armário climatizado C-01',  2, true,  189.00),
  ('Cartucho toner Brother TN-1060', 'TON-BRO-1060',  'Toner Brother TN-1060 preto',              'IMPRESSAO',   'un', 'consumivel', 'Armário climatizado C-01',  2, true,  210.00),
  ('Mouse óptico USB',               'MOU-USB-OPT',   'Mouse óptico USB 1000 DPI, plug and play', 'INFORMATICA', 'un', 'permanente', 'Prateleira B-02',           5, false,  35.00),
  ('Teclado USB ABNT2',              'TEC-USB-ABNT2', 'Teclado USB padrão ABNT2',                 'INFORMATICA', 'un', 'permanente', 'Prateleira B-03',           5, false,  42.00),
  ('Álcool 70% 1L',                  'LIM-ALC-70-1L', 'Álcool 70% líquido, frasco de 1 litro',    'LIMPEZA',     'lt', 'consumivel', 'Armário A-04',              4, false,  18.00);

do $$
declare
  v       record;
  v_item  uuid;
  v_batch uuid;
begin
  for v in
    select * from (values
      ('PAP-A4-75G',    'L-PAP-01', null::integer, 40,  20),
      ('TON-HP-85A',    'L-HP-02',  45,             6,  30),
      ('TON-HP-85A',    'L-HP-01',  -10,            1, 200),
      ('TON-BRO-1060',  'L-BRO-01', 400,            1, 150),
      ('MOU-USB-OPT',   'L-MOU-01', null,          12,  60),
      ('TEC-USB-ABNT2', 'L-TEC-01', null,           3,  60),
      ('LIM-ALC-70-1L', 'L-ALC-01', null,          10,  15)
    ) as t(sku, lot, exp_days, qty, recv_days)
  loop
    select id into v_item from public.items where sku = v.sku;

    insert into public.batches
      (item_id, lot_number, expires_on, quantity_received, quantity_remaining,
       supplier, invoice_number, received_at)
    values
      (v_item, v.lot,
       case when v.exp_days is null then null else public.today_br() + v.exp_days end,
       v.qty, v.qty, 'Fornecedor demonstração', 'NF-DEMO',
       now() - make_interval(days => v.recv_days))
    returning id into v_batch;

    insert into public.stock_movements (item_id, batch_id, type, quantity, note, performed_by, created_at)
    values (v_item, v_batch, 'ENTRADA', v.qty, 'Estoque inicial (demonstração)', null,
            now() - make_interval(days => v.recv_days));
  end loop;
end $$;

-- ============================================================================
-- 11. Faz a API do Supabase enxergar tudo imediatamente
-- ============================================================================
notify pgrst, 'reload schema';

commit;

-- ============================================================================
-- DEPOIS DE RODAR (passos manuais, fora desta transação)
-- ----------------------------------------------------------------------------
-- A) Authentication → Sign In / Providers → Email: desligar "Confirm email".
-- B) Authentication → Users → Add user: crie o primeiro usuário e promova:
--      update public.profiles set role = 'gestor_ti', active = true
--       where id = (select id from auth.users where email = 'SEU-EMAIL');
-- C) Conferir:
--      select count(*) from public.items;                 -- 6
--      select * from public.vw_stock_overview;            -- (logado no app)
--      select tablename, rowsecurity from pg_tables
--       where schemaname = 'public';                      -- todas true
-- ============================================================================

-- ============================================================================
-- RESET (comentado): apaga TUDO que este arquivo cria, para rodar de novo.
-- Descomente, rode sozinho e depois rode o arquivo inteiro outra vez.
-- ============================================================================
-- begin;
-- drop trigger if exists on_auth_user_created on auth.users;
-- drop view  if exists public.vw_audit, public.vw_consumption, public.vw_movements,
--   public.vw_approval_queue, public.vw_delivery_history, public.vw_alerts,
--   public.vw_stock_overview, public.vw_requests;
-- drop table if exists public.audit_log, public.stock_movements, public.requests,
--   public.batches, public.stock, public.items, public.profiles cascade;
-- drop function if exists public.create_requests(jsonb, text, text), public.approve_request(uuid),
--   public.reject_request(uuid, text), public.cancel_request(uuid), public.start_separation(uuid),
--   public.deliver_request(uuid), public.receive_stock(uuid, integer, text, date, text, text),
--   public.adjust_stock(uuid, integer, text), public.discard_batch(uuid, integer, text),
--   public.admin_list_users(), public.admin_update_profile(uuid, text, text, boolean),
--   public.handle_new_user(), public.apply_stock_movement(), public.prevent_mutation(),
--   public.enforce_request_transition(), public.touch_updated_at(), public.audit_trigger(),
--   public.is_active_user(), public.has_role(public.user_role), public.is_stock_manager(),
--   public.is_staff(), public.app_param(text), public.today_br();
-- drop type if exists public.audit_action, public.movement_type, public.request_status,
--   public.item_type, public.item_category, public.user_role;
-- commit;
