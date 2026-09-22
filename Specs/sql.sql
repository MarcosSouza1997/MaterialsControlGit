-- ============================================================================
-- INSUMOS CONTROL v1.0 — Esquema completo para Supabase (PostgreSQL 15+)
-- Execute no SQL Editor do Supabase, na ordem, numa transação única.
-- ============================================================================
begin;

-- ============================================================================
-- 0. EXTENSÕES
-- ============================================================================
create extension if not exists "pgcrypto";  -- gen_random_uuid()

-- ============================================================================
-- 1. ENUMS (facilitam checagens e integridade)
-- ============================================================================
create type user_role      as enum ('solicitante', 'almoxarife', 'gestor_ti', 'diretoria');
create type item_type      as enum ('consumivel', 'permanente');
create type item_category  as enum ('PAPELARIA', 'INFORMATICA', 'LIMPEZA', 'IMPRESSAO', 'OUTROS');
create type request_status as enum ('PENDENTE', 'APROVADO', 'EM_SEPARACAO', 'ENTREGUE', 'REJEITADO');
create type movement_type  as enum ('ENTRADA', 'SAIDA', 'AJUSTE');
create type audit_action   as enum ('INSERT', 'UPDATE', 'DELETE');

-- ============================================================================
-- 2. TABELAS
-- ============================================================================

-- 2.1 Perfis (espelha auth.users; role gerenciada pelo gestor_ti)
create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text not null check (char_length(full_name) between 2 and 120),
  role        user_role not null default 'solicitante',
  cost_center text,                                  -- centro de custo padrão
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

comment on column public.profiles.role is 'Perfil de acesso; só gestor_ti pode alterar';

-- 2.2 Catálogo de itens
create table public.items (
  id             uuid primary key default gen_random_uuid(),
  name           text not null unique check (char_length(name) between 2 and 120),
  category       item_category not null default 'OUTROS',
  unit           text not null default 'un' check (unit in ('un','cx','pct','rl','lt','kg')),
  type           item_type not null,                 -- RN-02/RN-03: define fluxo de aprovação
  reorder_point  integer not null default 0 check (reorder_point >= 0),
  requires_expiry boolean not null default false,    -- true para toner (RN-07)
  active         boolean not null default true,
  created_at     timestamptz not null default now()
);

-- 2.3 Saldo atual (mantido por trigger — nunca editar diretamente)
create table public.stock (
  item_id   uuid primary key references public.items(id) on delete cascade,
  quantity  integer not null default 0 check (quantity >= 0),
  updated_at timestamptz not null default now()
);

-- 2.4 Lotes (controle de validade — toner etc.)
create table public.batches (
  id          uuid primary key default gen_random_uuid(),
  item_id     uuid not null references public.items(id) on delete cascade,
  lot_number  text,
  expires_on  date,
  quantity    integer not null check (quantity > 0),
  received_at timestamptz not null default now(),
  received_by uuid not null references public.profiles(id)
);
create index batches_expiry_idx on public.batches (expires_on) where expires_on is not null;

-- 2.5 Pedidos / requisições
create table public.requests (
  id            uuid primary key default gen_random_uuid(),
  requester_id  uuid not null references public.profiles(id),
  item_id       uuid not null references public.items(id),
  quantity      integer not null check (quantity > 0),
  justification text not null check (char_length(justification) >= 10),
  cost_center   text,
  status        request_status not null default 'PENDENTE',
  approved_by   uuid references public.profiles(id),
  approved_at   timestamptz,
  reject_reason text check (status <> 'REJEITADO' or reject_reason is not null),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
-- RN-01: um só pedido ativo por (colaborador, item)
create unique index unique_active_request_per_item
  on public.requests (requester_id, item_id)
  where status in ('PENDENTE', 'APROVADO', 'EM_SEPARACAO');
create index requests_status_idx on public.requests (status);
create index requests_requester_idx on public.requests (requester_id, created_at desc);

-- 2.6 Movimentações de estoque (imutável — apenas INSERT)
create table public.stock_movements (
  id           uuid primary key default gen_random_uuid(),
  item_id      uuid not null references public.items(id),
  type         movement_type not null,
  quantity     integer not null check (quantity <> 0),  -- sinalizado: +entrada / -saída
  request_id   uuid references public.requests(id),     -- obrigatório p/ SAIDA
  note         text check (type <> 'AJUSTE' or note is not null),
  performed_by uuid not null references public.profiles(id),
  created_at   timestamptz not null default now(),
  constraint saida_sem_pedido check (type <> 'SAIDA' or request_id is not null),
  constraint entrada_com_pedido check (type <> 'ENTRADA' or request_id is null)
);
create index movements_item_idx on public.stock_movements (item_id, created_at desc);

-- 2.7 Auditoria (append-only — sem UPDATE/DELETE, nem para o service_role)
create table public.audit_log (
  id          bigint generated always as identity primary key,
  table_name  text not null,
  record_id   uuid,
  action      audit_action not null,
  old_data    jsonb,
  new_data    jsonb,
  changed_by  uuid,
  changed_at  timestamptz not null default now()
);
create index audit_table_idx on public.audit_log (table_name, changed_at desc);

-- ============================================================================
-- 3. FUNÇÕES AUXILIARES
-- ============================================================================

-- 3.1 Verifica papel do usuário autenticado (usada nas policies)
create or replace function public.has_role(p user_role)
returns boolean
language sql stable security definer set search_path = public as
$$ select exists (select 1 from profiles where id = auth.uid() and role = p and active) $$;

create or replace function public.is_stock_manager()
returns boolean language sql stable security definer set search_path = public as
$$ select public.has_role('almoxarife') or public.has_role('gestor_ti') $$;

create or replace function public.is_management()
returns boolean language sql stable security definer set search_path = public as
$$ select public.has_role('gestor_ti') or public.has_role('diretoria') $$;

-- 3.2 Auto-cria perfil ao registrar usuário (trigger no auth.users)
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)));
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 3.3 Atualiza saldo a partir das movimentações (RN-06: constraint garante >= 0)
create or replace function public.apply_stock_movement()
returns trigger
language plpgsql security definer set search_path = public as $$
declare current_qty integer;
begin
  insert into public.stock (item_id, quantity)
  values (new.item_id, 0)
  on conflict (item_id) do nothing;

  select quantity into current_qty from public.stock where item_id = new.item_id for update;

  if current_qty + new.quantity < 0 then
    raise exception 'Estoque insuficiente para item %: saldo %, saída %',
      new.item_id, current_qty, abs(new.quantity);
  end if;

  update public.stock
  set quantity = quantity + new.quantity, updated_at = now()
  where item_id = new.item_id;

  return new;
end $$;

drop trigger if exists trg_apply_movement on public.stock_movements;
create trigger trg_apply_movement
  after insert on public.stock_movements
  for each row execute function public.apply_stock_movement();

-- 3.4 Fecha pedido: gera SAIDA vinculada ao pedido (garante paridade pedido↔estoque)
create or replace function public.deliver_request(p_request_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare r public.requests%rowtype;
begin
  select * into r from public.requests where id = p_request_id for update;

  if not found then raise exception 'Pedido não encontrado'; end if;
  if r.status <> 'EM_SEPARACAO' then
    raise exception 'Pedido deve estar EM_SEPARACAO (status atual: %)', r.status;
  end if;
  if not public.is_stock_manager() then
    raise exception 'Somente almoxarife/gestor pode entregar'; end if;

  insert into public.stock_movements (item_id, type, quantity, request_id, performed_by)
  values (r.item_id, 'SAIDA', -r.quantity, r.id, auth.uid());

  update public.requests
  set status = 'ENTREGUE', updated_at = now()
  where id = p_request_id;
end $$;

-- 3.5 Auditoria genérica (INSERT/UPDATE/DELETE → audit_log)
create or replace function public.audit_trigger()
returns trigger
language plpgsql security definer set search_path = public as $$
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

create trigger trg_audit_items     after insert or update or delete on public.items     for each row execute function public.audit_trigger();
create trigger trg_audit_requests  after insert or update or delete on public.requests  for each row execute function public.audit_trigger();
create trigger trg_audit_movements after insert                        on public.stock_movements for each row execute function public.audit_trigger();
-- stock e audit_log são atualizados por triggers, sem auditoria recursiva de propósito.

-- 3.6 Valor aproximado do item (fase futura: tabela de preços)
-- criada coluna para RN-04 sem dependência de módulo de compras:
alter table public.items add column if not exists unit_price numeric(10,2) check (unit_price is null or unit_price >= 0);

-- 3.7 updated_at automático
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;

create trigger trg_touch_requests before update on public.requests for each row execute function public.touch_updated_at();

-- ============================================================================
-- 4. ROW LEVEL SECURITY
-- ============================================================================
alter table public.profiles        enable row level security;
alter table public.items           enable row level security;
alter table public.stock           enable row level security;
alter table public.batches         enable row level security;
alter table public.requests        enable row level security;
alter table public.stock_movements enable row level security;
alter table public.audit_log       enable row level security;

-- 4.1 profiles
create policy profiles_select on public.profiles for select to authenticated using (true);
create policy profiles_update_self on public.profiles for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid() and role = (select role from profiles where id = auth.uid()));
create policy profiles_admin on public.profiles for update to authenticated
  using (public.has_role('gestor_ti'))
  with check (public.has_role('gestor_ti'));

-- 4.2 items — leitura para todos; escrita somente estoque/gestão
create policy items_select on public.items for select to authenticated using (true);
create policy items_insert on public.items for insert to authenticated with check (public.is_stock_manager());
create policy items_update on public.items for update to authenticated using (public.is_stock_manager()) with check (public.is_stock_manager());

-- 4.3 stock — leitura para todos; escrita APENAS via trigger (definer)
create policy stock_select on public.stock for select to authenticated using (true);

-- 4.4 batches — leitura pública, escrita somente almoxarife/gestor
create policy batches_select on public.batches for select to authenticated using (true);
create policy batches_insert on public.batches for insert to authenticated with check (public.is_stock_manager());
create policy batches_delete on public.batches for delete to authenticated using (public.is_stock_manager());

-- 4.5 requests
create policy requests_select on public.requests for select to authenticated
  using (requester_id = auth.uid() or public.is_stock_manager() or public.has_role('diretoria'));
create policy requests_insert on public.requests for insert to authenticated
  with check (requester_id = auth.uid() and public.has_role('solicitante'));
create policy requests_approve on public.requests for update to authenticated
  using (status = 'PENDENTE' and public.is_stock_manager())
  with check (status in ('APROVADO','REJEITADO') and approved_by = auth.uid());
create policy requests_separate on public.requests for update to authenticated
  using (status = 'APROVADO' and public.has_role('almoxarife'))
  with check (status = 'EM_SEPARACAO');

-- 4.6 stock_movements — INSERT direto somente para ENTRADA/AJUSTE por estoque;
-- SAIDAS só ocorrem via public.deliver_request (security definer)
create policy movements_select on public.stock_movements for select to authenticated
  using (public.is_stock_manager() or public.has_role('diretoria'));
create policy movements_insert on public.stock_movements for insert to authenticated
  with check (
    public.is_stock_manager()
    and performed_by = auth.uid()
    and type in ('ENTRADA', 'AJUSTE')   -- SAIDA é bloqueada: use deliver_request()
  );

-- 4.7 audit_log — append-only; leitura só gestão
create policy audit_select on public.audit_log for select to authenticated
  using (public.has_role('gestor_ti') or public.has_role('diretoria'));

-- ============================================================================
-- 5. SEED — dados mínimos para homologação
-- ============================================================================

-- 5.1 Itens típicos (valores aproximados; RN-04 usa unit_price * quantity)
insert into public.items (name, category, unit, type, reorder_point, requires_expiry, unit_price) values
  ('Resma de papel A4 75g',      'PAPELARIA',  'rl', 'consumivel', 10, false, 28.00),
  ('Cartucho toner HP 85A',      'IMPRESSAO',  'un', 'consumivel',  2, true,  189.00),
  ('Cartucho toner Brother TN-1060','IMPRESSAO','un','consumivel',  2, true,  210.00),
  ('Mouse óptico USB',           'INFORMATICA','un', 'permanente',  5, false,  35.00),
  ('Teclado USB ABNT2',          'INFORMATICA','un', 'permanente',  5, false,  42.00),
  ('Álcool 70% 1L',              'LIMPEZA',    'lt', 'consumivel',  4, false,  18.00)
on conflict (name) do nothing;

-- ============================================================================
-- 6. VIEWS ÚTEIS (para relatórios sem lógica no front)
-- ============================================================================

-- Alertas de estoque baixo (RN-06) e validade (RN-07)
create or replace view public.vw_alerts as
select 'ESTOQUE_BAIXO' as alert_type, i.name, s.quantity,
       i.reorder_point as threshold, null::date as expires_on
from public.stock s join public.items i on i.id = s.item_id
where i.active and s.quantity <= i.reorder_point
union all
select 'VALIDADE', i.name, b.quantity, null::int, b.expires_on
from public.batches b join public.items i on i.id = b.item_id
where i.active and b.expires_on is not null and b.expires_on <= current_date + interval '60 days';

-- Fila de aprovação por perfil (RN-04: acima de R$200 vai ao gestor_ti)
create or replace view public.vw_approval_queue as
select r.*, i.name as item_name, i.unit_price,
       coalesce(i.unit_price * r.quantity, 0) as total_value,
       case when public.has_role('gestor_ti') then
         (coalesce(i.unit_price * r.quantity, 0) > 200)
       else
         (coalesce(i.unit_price * r.quantity, 0) <= 200)
       end as my_turn
from public.requests r join public.items i on i.id = r.item_id
where r.status = 'PENDENTE';

commit;

-- ============================================================================
-- 7. TESTES RÁPIDOS (executar após criar usuários de teste)
-- ============================================================================
-- a) RN-01: inserir dois pedidos ativos do mesmo item para o mesmo usuário
--    → o segundo deve falhar com violação de unique_active_request_per_item.
-- b) RN-06: registrar ENTRADA de 5 e SAIDA de 10 via deliver_request
--    → deve falhar com 'Estoque insuficiente'.
-- c) RLS: logado como solicitante, executar:
--      update profiles set role = 'gestor_ti' where id = auth.uid();
--    → deve ser negado pela policy profiles_update_self.
