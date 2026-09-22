# 📦 SPEC-DRIVEN DEVELOPMENT — Sistema Interno de Requisição e Controle de Insumos
**Nome de trabalho:** Insumos Control v1.0
**Stack:** HTML5 / CSS3 / JavaScript (ES Modules) · Supabase (PostgreSQL + Auth + RLS) · GitHub Pages
**Autor:** Gestão de TI | **Data:** 15/09/2026 | **Status:** Aprovado para MVP

---

## 1. Contexto e Problema
A empresa não possui controle sobre insumos internos. Sintomas observados:
- Resmas de papel desaparecem sem registro de destino
- Cartuchos de toner "secam" parados em estoque (falta visibilidade de validade/lote)
- Mouses e teclados são solicitados em duplicidade por colaboradores
- Não há trilha de auditoria: *quem pegou, quanto, quando e para onde*

### 1.1 Causa raiz
Ausência de um sistema de registro centralizado com regras de aprovação e estoque em tempo real.

---

## 2. Objetivo do Produto
Criar um software interno web que garanta **rastreabilidade total** dos insumos, do pedido ao consumo, eliminando perdas e duplicidades.

### 2.1 KPIs de sucesso (meta: 6 meses)
| KPI | Linha de base | Meta |
|---|---|---|
| Perdas não rastreadas de papel | sem medida | 100% das saídas registradas |
| Solicitações duplicadas (mouse/teclado) | frequente | 0 duplicidades ativas por colaborador |
| Tempo médio de atendimento de pedido | sem medida | ≤ 48h úteis |
| Visibilidade de estoque | nenhuma | 100% dos itens com saldo em tempo real |

### 2.2 Fora de escopo (MVP)
- Compras/integração com fornecedores
- Orçamento por centro de custo
- Apps mobile nativos
- Notificações por e-mail/SMS (fase 2)

---

## 3. Personas
| Persona | Descrição |
|---|---|
| **Solicitante** | Qualquer colaborador com conta. Faz pedidos e acompanha status. |
| **Almoxarife (Estoque)** | CRUD de itens, entrada de notas, baixa de saídas, aprova pedidos simples. |
| **Gestor de TI** (você) | Aprova pedidos acima de limite, administra usuários e perfis, acessa relatórios e auditoria. |
| **Diretoria** | Somente leitura: dashboards e relatórios de consumo. |

---

## 4. Regras de Negócio (RN)
| ID | Regra |
|---|---|
| RN-01 | Um colaborador não pode ter **mais de 1 pedido ativo** (pendente/em separação) do mesmo item de consumo (ex.: mouse, teclado). |
| RN-02 | Itens **recorrentes/consumíveis** (papel, toner) não passam por aprovação; saída é registrada diretamente pelo almoxarife. |
| RN-03 | Itens **permanentes/equipamentos** (mouse, teclado, monitor) exigem aprovação. |
| RN-04 | Pedidos de equipamentos **> R$ 200,00 (unitário ou total) requerem aprovação do Gestor de TI**; abaixo, almoxarife aprova. |
| RN-05 | Todo movimento (entrada/saída/ajuste) gera registro de **auditoria imutável** (usuário, timestamp, antes/depois). |
| RN-06 | Saída só pode ser registrada se houver **saldo suficiente** (constraint no banco + validação no front). |
| RN-07 | Toner possui campo opcional de **data de validade**; sistema deve alertar itens vencidos/próximos de vencer. |
| RN-08 | Status do pedido: `PENDENTE → APROVADO → EM_SEPARACAO → ENTREGUE` ou `PENDENTE → REJEITADO`. |
| RN-09 | Quantidade solicitada deve ser > 0 e inteira para itens indivisíveis. |
| RN-10 | Somente almoxarife pode dar entrada no estoque (compras). |

---

## 5. Requisitos Funcionais (RF)
### RF-01 — Autenticação
- Login via e-mail corporativo + senha (Supabase Auth, e-mail confirmado por domínio `empresa.com`).
- Perfis: `solicitante`, `almoxarife`, `gestor_ti`, `diretoria` (campo `role` na tabela `profiles`).

### RF-02 — Catálogo de Itens
- Almoxarife: cadastrar/editar/desativar itens (nome, categoria, unidade, ponto de reposição, tipo: `consumivel` | `permanente`, validade aplicável).
- Categorias: Papelaria, Informática, Limpeza, Impressão (toner), Outros.

### RF-03 — Requisição (Solicitante)
- Formulário: item, quantidade, justificativa (obrigatória para permanentes), centro de custo.
- Bloqueio automático se já houver pedido ativo do mesmo item (RN-01) — mensagem clara ao usuário.
- Listagem "Meus pedidos" com status em tempo real.

### RF-04 — Aprovação
- Fila de aprovação visível por perfil (almoxarife → gestor conforme RN-04).
- Aprovar/Rejeitar com motivo obrigatório em rejeição.

### RF-05 — Movimentação de Estoque
- Entrada (nota de compra, quantidade, lote, validade).
- Saída vinculada a um pedido ENTREGUE.
- Ajuste manual com justificativa (auditoria obrigatória).
- Saldo exibido em tempo real no catálogo.

### RF-06 — Alertas
- Estoque abaixo do ponto de reposição (destaque visual no painel do almoxarife).
- Toner vencido ou a vencer em 60 dias.

### RF-07 — Relatórios (Gestor/Diretoria)
- Consumo por período, por item, por solicitante e por centro de custo.
- Histórico completo de auditoria (filtros: usuário, item, data, tipo de movimento).

---

## 6. Requisitos Não Funcionais (RNF)
| ID | Requisito |
|---|---|
| RNF-01 | Front 100% estático (GitHub Pages); nenhum servidor próprio. |
| RNF-02 | Toda lógica de segurança no **Supabase RLS** — o front nunca é fonte de verdade de permissões. |
| RNF-03 | Performance: telas carregam ≤ 2s; listas paginadas (25/página). |
| RNF-04 | Auditoria imutável: tabela `audit_log` sem UPDATE/DELETE (apenas via INSERT). |
| RNF-05 | Design responsivo (desktop prioridade, funcional em tablet). |
| RNF-06 | Código modular ES Modules, sem framework, com `Supabase JS v2` via CDN. |
| RNF-07 | Suporte a navegadores: Chrome/Edge/Firefox (últimas 2 versões). |

---

## 7. Arquitetura Técnica
```
┌──────────────────┐         ┌─────────────────────────────┐
│  GitHub Pages    │  HTTPS  │  Supabase                   │
│  HTML/CSS/JS     ├────────►│  · Auth (email/senha)       │
│  (SPA estática)  │         │  · PostgreSQL + RLS         │
│  Chave anon key  │         │  · Realtime (status pedido) │
└──────────────────┘         └─────────────────────────────┘
```
- Repositório único; `main` → produção (GitHub Pages), `develop` → homologação (surge.netlify alternativo ou branch preview).
- Segredos: apenas `SUPABASE_URL` + `SUPABASE_ANON_KEY` (públicas por natureza — segurança real via RLS).

### Estrutura de pastas
```
/
├── index.html            (login)
├── app.html              (shell do sistema)
├── /pages/               (views: catalogo, pedidos, aprovacao, estoque, relatorios)
├── /js/
│   ├── config.js         (constantes do Supabase)
│   ├── supabase.js       (cliente singleton)
│   ├── auth.js
│   ├── guards.js         (controle de rota por role)
│   └── modules/          (ui, pedidos, estoque, relatorios)
├── /css/                 (tokens.css, components.css, layout.css)
└── .github/workflows/    (deploy automático)
```

---

## 8. Modelo de Dados (Supabase/PostgreSQL)
```sql
create table profiles (
  id uuid primary key references auth.users on delete cascade,
  full_name text not null,
  role text not null check (role in ('solicitante','almoxarife','gestor_ti','diretoria')),
  active boolean default true,
  created_at timestamptz default now()
);

create table items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null,
  unit text not null default 'un',
  item_type text not null check (item_type in ('consumivel','permanente')),
  reorder_point int not null default 0,
  active boolean default true,
  created_at timestamptz default now()
);

create table stock (
  item_id uuid primary key references items(id),
  quantity int not null default 0 check (quantity >= 0)
);

-- Lotes para controle de validade (toner)
create table batches (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references items(id),
  lot_number text,
  expires_on date,
  quantity int not null check (quantity > 0),
  received_at timestamptz default now()
);

create table requests (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references profiles(id),
  item_id uuid not null references items(id),
  quantity int not null check (quantity > 0),
  justification text,
  cost_center text,
  status text not null default 'PENDENTE'
    check (status in ('PENDENTE','APROVADO','EM_SEPARACAO','ENTREGUE','REJEITADO')),
  approved_by uuid references profiles(id),
  approved_at timestamptz,
  reject_reason text,
  created_at timestamptz default now()
);

-- RN-01: bloqueio de duplicidade em nível de banco
create unique index unique_active_request
  on requests (requester_id, item_id)
  where status in ('PENDENTE','APROVADO','EM_SEPARACAO');

create table stock_movements (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references items(id),
  movement_type text not null check (movement_type in ('ENTRADA','SAIDA','AJUSTE')),
  quantity int not null,             -- sinalizado: + entrada, - saída
  request_id uuid references requests(id),
  note text,
  performed_by uuid not null references profiles(id),
  created_at timestamptz default now()
);

-- Auditoria imutável
create table audit_log (
  id bigint generated always as identity primary key,
  table_name text not null,
  record_id uuid,
  action text not null,             -- INSERT/UPDATE/DELETE
  old_data jsonb,
  new_data jsonb,
  changed_by uuid,
  changed_at timestamptz default now()
);

-- Saldo via movimentos + trigger (RFC: RN-06)
create or replace function update_stock() returns trigger as $$
begin
  if tg_op = 'INSERT' then
    insert into stock (item_id, quantity) values (new.item_id, 0)
    on conflict (item_id) do nothing;
    update stock set quantity = quantity + new.quantity where item_id = new.item_id;
  end if;
  return new;
end; $$ language plpgsql security definer;
```

### 8.1 RLS Policies (essencial)
| Tabela | Política |
|---|---|
| `profiles` | SELECT: autenticado. UPDATE role: somente `gestor_ti`. |
| `items` | SELECT: autenticado. INSERT/UPDATE: `almoxarife` ou `gestor_ti`. |
| `requests` | SELECT: próprio ou perfis de estoque/gestão. INSERT: qualquer solicitante (com validação RN-01 via constraint). UPDATE status: conforme etapa (almoxarife/gestor). |
| `stock_movements` | SELECT: perfis de estoque/gestão. INSERT: `almoxarife`. Nunca UPDATE/DELETE. |
| `audit_log` | SELECT: `gestor_ti` e `diretoria`. INSERT: service_role (triggers). Nunca UPDATE/DELETE. |

---

## 9. Fluxos de Tela (UX)
1. **Login** → `index.html`
2. **Dashboard do Solicitante**: saldo rápido, botão "Novo pedido", "Meus pedidos"
3. **Novo Pedido**: busca de item com foto/saldo, validação de duplicidade em tempo real
4. **Painel do Almoxarife**: filas (Aprovações pendentes, Separação, Alertas de estoque/baixo, Validade)
5. **Painel do Gestor**: fila de aprovações > R$200, relatórios, admin de usuários
6. **Diretoria**: dashboard somente leitura com gráficos de consumo

---

## 10. Definition of Done (por User Story)
- [ ] Código revisado + merge em `main` com CI verde
- [ ] RLS policies aplicadas e testadas (teste com usuário de cada perfil)
- [ ] Trigger/constraint de estoque testado (saída sem saldo deve falhar)
- [ ] Log de auditoria gerado em toda mutação
- [ ] Deploy automático no GitHub Pages funcionando

---

## 11. Roadmap
| Fase | Entrega |
|---|---|
| **MVP (4–6 semanas)** | Auth, catálogo, pedidos, aprovação, estoque básico, auditoria |
| Fase 2 | Realtime (status ao vivo), notificações e-mail, centro de custo |
| Fase 3 | Painel diretoria avançado, exportação CSV/Excel, integração com compras |

---

## 12. Riscos e Mitigações
| Risco | Mitigação |
|---|---|
| Colaboradores contornam o sistema (pegar sem pedir) | Política interna + auditoria mensal de consumo |
| Chave anon vazada | RLS bem definida; chave tem poder de "anon", não admin |
| Concorrência de estoque (dois almoxarifes simultâneos) | Constraints + transações no Postgres |
| Vício em front sem framework crescer | Manter módulos pequenos; reavaliar framework na Fase 3 |

---
*Documento vivo: revisões aprovadas via PR. Próximo passo: validar RN-04 (limite R$ 200) e unidades de medida com a diretoria.*
