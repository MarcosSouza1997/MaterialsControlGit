# 🛠️ TASKS.md — Plano de execução para agente de codificação
**Projeto:** Insumos Control v1.0
**Stack:** HTML5 / CSS3 / JS (ES Modules, sem framework) / Supabase JS v2 / GitHub Pages
**Referências:** `spec-insumos-control-v1.md` (regras de negócio) · `supabase-schema-insumos.sql` (schema executado)
**Regra de ouro:** Toda permissão é validada por RLS no banco. O front nunca confia no próprio estado — refaça `select` após cada mutação.

---

## Convenções para o agente
- Cada tarefa é atômica: um commit por tarefa, mensagem no formato `[T-XXX] descrição curta`.
- Antes de codar, leia a seção do spec citada em **Contexto**.
- Ao terminar, rode os **Critérios de aceite** manualmente no navegador antes de declarar concluído.
- Se um critério falhar por limitação do Supabase (ex.: policy impede a query), NÃO enfraqueça a policy — ajuste a query ou crie uma RPC no banco.
- Design system: tokens em `/css/tokens.css` (cores, espaçamento); componentes em `/css/components.css`; nada de CSS inline.

---

## FASE 0 — Fundação do repositório

### T-001 — Estrutura de pastas e arquivos base
**Contexto:** spec §7 (Arquitetura)
- Criar estrutura: `/pages/`, `/js/modules/`, `/css/`, `/.github/workflows/`.
- Criar `js/config.js` exportando `SUPABASE_URL` e `SUPABASE_ANON_KEY` lidos de `window.__ENV` (definido em `config.js` — arquivo versionado com placeholders, valores reais preenchidos localmente e por secret no CI).
- Criar `js/supabase.js`: instância singleton do cliente (`createClient`).
- Criar `css/tokens.css` com variáveis: `--color-primary`, `--color-danger`, `--color-success`, `--color-warning`, `--space-*`, `--radius-*`.
- Criar `index.html` vazio com link para `tokens.css` e `components.css`.

✅ **Aceite:** `index.html` abre sem erros no console; `supabase-js` v2 carregado via CDN; pasta estrutura idêntica à do spec.

---

## FASE 1 — Autenticação e papéis

### T-002 — Tela de login
**Contexto:** spec §5 RF-01
- Formulário e-mail corporativo + senha com `supabase.auth.signInWithPassword`.
- Tratamento de erro exibindo mensagem do Supabase em pt-BR (mapa: `Invalid login credentials` → "E-mail ou senha incorretos").
- Redirecionar para `app.html` após `SIGNED_IN`.

✅ **Aceite:** login com usuário real redireciona; senha errada mostra mensagem clara; `localStorage` contém sessão após refresh (persistSession default).

### T-003 — Guarda de rota e carregamento do perfil
**Contexto:** spec §5 RF-01 · schema `profiles`, `has_role()`
- Em `app.html` e toda view: `guards.js` com `requireAuth()` (redireciona ao `index.html` se sem sessão) e `requireRole(...roles)`.
- Ao carregar, buscar `profiles` do usuário e guardar em estado global (`state.profile`).
- Se `profile.active = false`, deslogar e mostrar "Conta desativada".

✅ **Aceite:** acesso direto a `app.html` sem login → redireciona; usuário `solicitante` acessando view de relatórios → bloqueado com mensagem (sem depender só de esconder o menu).

### T-004 — Shell de navegação com menu por papel
**Contexto:** spec §9 (fluxos de tela)
- `app.html` com sidebar: Dashboard, Novo Pedido, Meus Pedidos, (Almoxarife: Aprovações, Separação, Estoque, Entradas), (Gestor: Relatórios, Usuários), (Diretoria: Relatórios).
- Itens visíveis conforme `state.profile.role` — puro CSS + `hidden`.

✅ **Aceite:** login com cada um dos 4 perfis mostra exatamente os menus previstos no spec §9.

---

## FASE 2 — Catálogo de itens (RF-02)

### T-005 — Listagem de itens com saldo em tempo real
**Contexto:** schema `items`, `stock`, view `vw_alerts`
- Query: `items` + `stock(quantity)` via join, filtrando `active = true`.
- Tabela com: nome, categoria, unidade, saldo, ponto de reposição.
- Saldo ≤ reorder_point → badge "Estoque baixo" (cor `--color-warning`).
- Paginação client-side: 25/página (RNF-03).

✅ **Aceite:** saldo exibido confere com o valor no Supabase Dashboard; item com saldo baixo exibe badge.

### T-006 — CRUD de itens (almoxarife/gestor)
**Contexto:** spec §5 RF-02 · policy `items_insert/update`
- Modal com formulário: nome, categoria (select do enum), unidade, tipo (`consumivel`/`permanente`), reorder_point, `requires_expiry`, `unit_price`.
- Edit = `update`; desativar = `update {active:false}` (nunca delete).
- Validação: nome ≥ 2 chars; reorder_point ≥ 0.
- Botões visíveis só para `is_stock_manager()` (RLS já bloqueia o resto).

✅ **Aceite:** criar item como almoxarife aparece na listagem; como solicitante, POST retorna erro 42501 (RLS) e o botão sequer aparece.

---

## FASE 3 — Fluxo de requisição (RF-03, RF-04) — coração do sistema

### T-007 — Formulário "Novo Pedido"
**Contexto:** spec §5 RF-03 · RN-01, RN-03, RN-09
- Select de item (somente itens ativos; para itens permanentes a justificativa fica obrigatória, marcada com *).
- Quantidade: inteiro > 0; campo `cost_center` pré-preenchido do perfil.
- Inserir via `insert into requests` (requester_id = auth.uid()).
- Capturar erro `23505` do índice `unique_active_request_per_item` e exibir: *"Você já possui um pedido ativo deste item."* (RN-01 no front, com mensagem amigável).

✅ **Aceite:** criar pedido duplicado do mesmo item → mensagem RN-01, não quebra; justificativa < 10 chars → bloqueado; pedido criado aparece como PENDENTE.

### T-008 — "Meus pedidos" com status
**Contexto:** spec §5 RF-03 · schema `requests`
- Lista do usuário logado: item, quantidade, status (badge colorido), data, motivo de rejeição quando houver.
- Atualizar ao entrar e após criar pedido.

✅ **Aceite:** status PENDENTE (amarelo), APROVADO (azul), EM_SEPARACAO (roxo), ENTREGUE (verde), REJEITADO (vermelho com motivo visível).

### T-009 — Fila de aprovação por papel
**Contexto:** spec §5 RF-04 · RN-04 · view `vw_approval_queue`
- Query `vw_approval_queue` filtrando `my_turn = true`.
- Aprovar → `update {status:'APROVADO', approved_by, approved_at}`.
- Rejeitar → modal com motivo obrigatório → `update {status:'REJEITADO', reject_reason}`.
- A view decide: ≤ R$200 almoxarife, > R$200 gestor_ti. O front **não** reimplementa essa lógica.

✅ **Aceite:** almoxarife vê apenas pedidos ≤ R$200; gestor vê apenas > R$200; rejeição sem motivo é impossível (RLS + constraint no banco).

---

## FASE 4 — Estoque e movimentações (RF-05)

### T-010 — Entrada de estoque com lote
**Contexto:** spec §5 RF-05 · RN-10 · tabela `batches`
- Formulário: item, quantidade, número de lote (opcional), `expires_on` (obrigatório se `item.requires_expiry`).
- Insere em `batches` + `stock_movements {type:'ENTRADA', quantity:+N}` na mesma chamada RPC (`deliver_request` é modelo; criar `receive_stock(...)` no banco se precisar de atomicidade).

✅ **Aceite:** após entrada de 10 resmas, saldo na tabela `stock` aumentou 10; toner sem validade é rejeitado pelo formulário.

### T-011 — Separação e entrega (máquina de estados)
**Contexto:** spec §5 RF-05 · RN-08 · RPC `deliver_request()`
- Fila "Separação": pedidos `APROVADO` → botão "Separar" → `update {status:'EM_SEPARACAO'}`.
- Botão "Entregar" → `supabase.rpc('deliver_request', {p_request_id})`.
- Erro de estoque insuficiente (exceção do trigger) → toast vermelho com a mensagem do Postgres, status permanece EM_SEPARACAO.

✅ **Aceite:** tentar entregar pedido maior que o saldo → erro exibido, saldo inalterado, sem pedido ENTREGUE; sucesso → saldo baixou e pedido ENTREGUE.

### T-012 — Ajuste manual de estoque
**Contexto:** spec §5 RF-05 · RN-05
- Formulário: item, quantidade (positiva ou negativa), motivo obrigatório.
- Insere `stock_movements {type:'AJUSTE', note}`.

✅ **Aceite:** ajuste negativo maior que o saldo → exceção 'Estoque insuficiente'; ajuste gera linha na `audit_log`.

### T-013 — Painel de alertas (almoxarife)
**Contexto:** spec §5 RF-06 · view `vw_alerts`
- Query `vw_alerts`: cards de "Estoque baixo" e "Validade (≤ 60 dias)" com nome, saldo/prazo.

✅ **Aceite:** dados coincidem com o Supabase Dashboard; toner vencido há 10 dias aparece em Validade.

---

## FASE 5 — Relatórios e auditoria (RF-07)

### T-014 — Relatório de consumo
**Contexto:** spec §5 RF-07 · tabelas `stock_movements`, `requests`
- Filtros: período (data início/fim), item, solicitante, centro de custo.
- Agrupamentos: por item (total saído), por solicitante, por centro de custo.
- Renderizar em tabela + botão "Exportar CSV" (gerado client-side).

✅ **Aceite:** totais batem com soma manual de `stock_movements type='SAIDA'` no período; CSV abre no Excel com encoding correto (BOM UTF-8).

### T-015 — Visão de auditoria (gestor/diretoria)
**Contexto:** spec §5 RF-07 · tabela `audit_log`
- Tabela: data, usuário, tabela, ação, diff resumido (expandir mostra old_data/new_data formatados JSON).
- Filtros: tabela, usuário, período.

✅ **Aceite:** cada ação das Fases 2–4 está registrada com `changed_by` correto; solicitante recebe 403 ao consultar.

### T-016 — Administração de usuários (gestor_ti)
**Contexto:** spec §5 RF-01 · policy `profiles_admin`
- Lista de perfis com role e `active`.
- Editar role (select dos 4 valores) e ativar/desativar.

✅ **Aceite:** desativar usuário impede novo login na próxima sessão (`active` checado em T-003); mudança de role reflete no menu após re-login.

---

## FASE 6 — Deploy e CI

### T-017 — Workflow GitHub Actions → GitHub Pages
**Contexto:** spec §7 · RNF-01
- Workflow em `.github/workflows/deploy.yml`: push em `main` → build estático (não há build; apenas validação) → deploy Pages via `actions/deploy-pages`.
- Secrets: `SUPABASE_URL`, `SUPABASE_ANON_KEY` injetados em `js/config.js` no momento do deploy (step de replace via `sed` ou template).

✅ **Aceite:** push em `main` publica em `https://<org>.github.io/<repo>/`; site em produção autentica contra o Supabase real.

### T-018 — Realtime nos status de pedido
**Contexto:** spec §7 (Realtime) — *opcional, fase 2; incluir se sobrar tempo*
- `supabase.channel('requests').on('postgres_changes', ...)` atualizando "Meus pedidos" e filas sem refresh.

✅ **Aceite:** aprovar pedido em outra aba reflete na aba do solicitante em < 2s.

---

## Checklist final (Definition of Done global)
- [ ] Todos os critérios de aceite de T-001 a T-017 verificados
- [ ] Testes manuais do schema §7 executados (RN-01, RN-06, RLS)
- [ ] Nenhum segredo hardcoded no código (apenas `window.__ENV`)
- [ ] `audit_log` populado por toda mutação das Fases 2–5
- [ ] 4 perfis de teste criados no Supabase Auth (um de cada papel)

## Ordem de execução recomendada
`T-001 → T-002 → T-003 → T-004 → T-007 → T-008 → T-005 → T-006 → T-009 → T-010 → T-011 → T-012 → T-013 → T-014 → T-015 → T-016 → T-017 → T-018`
(Corte vertical: autenticação → pedido completo → estoque → relatórios → deploy.)
