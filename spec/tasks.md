# TASKS — Materials Control v1.0

**Referências:** `spec/spec.md` (regras e requisitos) · `spec/schema.sql` (banco) · `theme/DESIGN.md` (cores, fontes, componentes) · `theme/stitch_remix_of_materials_control_ui/` (protótipos das telas)
**Site publicado:** https://marcossouza1997.github.io/MaterialsControlGit/ (GitHub Pages, branch `main`, pasta raiz)

---

## Como usar (para o dono do projeto)
1. Faça os **passos manuais P-1 a P-6** abaixo. O Jules não consegue fazê-los.
2. No Jules, dispare **uma tarefa por vez**, colando a seção **"Contexto e regras gerais"** e o **"Contrato do banco"** junto com o texto da tarefa.
3. Depois de mergear a PR, espere cerca de 1 minuto e abra o site com **Ctrl+F5**.
4. Cada tarefa termina com **"Como o dono verifica"**. Se você não vê aquilo no site, a tarefa não está pronta: rejeite a PR. Não dispare a próxima antes.

### Passos manuais do dono
- **P-1.** Supabase → SQL Editor: rodar o `spec/schema.sql` inteiro. Deve terminar sem erro.
- **P-2.** Supabase → Authentication → Sign In / Providers → Email: **desligar "Confirm email"**.
- **P-3.** Supabase → Authentication → Users → Add user: criar o **primeiro usuário** (será o gestor). Depois, no SQL Editor:
  `update public.profiles set role = 'gestor_ti', active = true where id = (select id from auth.users where email = 'SEU-EMAIL');`
- **P-4.** Criar mais 3 usuários de teste (solicitante, almoxarife, diretoria). Depois de T-014 (tela Usuários) o gestor ativa e muda o perfil deles pela tela; antes disso, use `update public.profiles set role = '...', active = true where id = (select id from auth.users where email = '...');`
- **P-5.** No repositório, criar as pastas `spec/` (com `spec.md`, `tasks.md`, `schema.sql`) e `theme/` (com `DESIGN.md` e a pasta `stitch_remix_of_materials_control_ui/`).
- **P-6.** GitHub → Settings → Pages → *Deploy from a branch* → `main` → `/ (root)`. Só depois da T-001.

---

## CONTEXTO E REGRAS GERAIS (colar em toda tarefa)

**Produto:** sistema interno de requisição e controle de insumos (papel, toner, mouse, teclado, limpeza). Front estático em HTML/CSS/JS (ES Modules, **sem framework, sem Tailwind, sem build**) + Supabase (Auth, Postgres, RLS). O banco **já está pronto** (`spec/schema.sql` já executado): **não altere o banco**.

**Antes de qualquer tarefa, leia:** `spec/spec.md`, `theme/DESIGN.md` e o código já existente no repositório. Se `theme/` ou `spec/` não existirem, **pare e avise**; não invente o visual.

**Conexão com o Supabase (valores públicos por natureza):**
- URL: `https://gowloybphtxkbffrygre.supabase.co`
- Chave publishable: `sb_publishable_5JCxxUHsrerPsca28NLnTQ_eWpFKR6l`
- Não use nenhuma outra chave e nunca coloque senha ou chave secret no código.

**Protótipos:** cada pasta em `theme/stitch_remix_of_materials_control_ui/` tem `screen.png` (alvo visual) e `code.html` (estrutura de referência em Tailwind, **não copiar**). Pastas: `dashboard_geral_materials_control`, `cat_logo_e_requisi_o_materials_control`, `central_de_aprova_es_materials_control`, `controle_de_estoque_materials_control`. Para telas sem protótipo, siga `DESIGN.md` e o padrão de tabelas, filtros e cartões das telas existentes. Se existir uma pasta de protótipo nova para a tela, use-a.

### Regras obrigatórias
- **R1 — Proibido placeholder.** Nenhum texto "em desenvolvimento", botão sem função, menu sem tela ou dado fictício fixo no código. Sem dado, mostre estado vazio explicativo. Elemento do protótipo sem dado ou fluxo no banco **não é renderizado** e vai listado na descrição da PR.
- **R2 — Fidelidade visual.** Reproduza layout, hierarquia e componentes do `screen.png`. Cores só por variável de `css/tokens.css` (bloco da seção 6 do `DESIGN.md`); fontes Inter e JetBrains Mono; ícones Material Symbols Outlined. Estilos em `css/components.css` ou `css/<tela>.css`. **Nada de `style="..."` inline** (exceto valores calculados pelo JS em tempo de execução, como largura de barra de gráfico) e **nada de Tailwind**.
- **R3 — Dados reais; o banco manda.** Toda leitura e escrita usa o cliente de `js/supabase.js`. Leituras usam as **views** e tabelas do contrato; operações que mudam estado usam **somente as funções (RPC)** do contrato. O front nunca define `status`, `approved_by` ou saldo, nem reimplementa alçada, FEFO ou permissão. Após qualquer mutação, refaça o select.
- **R4 — Erros visíveis.** Todo `await` ao Supabase trata `error` e mostra toast em português. Mapear: `23505` → mensagem da regra correspondente; `42501` → "Você não tem permissão para esta ação"; exceções levantadas pelas funções (`P0001`) → mostrar `error.message`. Nunca engolir erro; nunca deixar a tela em "Carregando..." para sempre.
- **R5 — Segurança de HTML.** Texto vindo do banco nunca entra em `innerHTML` sem passar por `esc()` de `js/ui.js`. Prefira `textContent`.
- **R6 — Não alterar o banco.** Se faltar algo, **pare e descreva na PR** o que falta.
- **R7 — Estrutura.** Roteamento por hash. Cada tela é um módulo `js/modules/<tela>.js` exportando `render(container, ctx)`, com `ctx = { profile, supabase }`. Helpers em `js/ui.js`.
- **R8 — Entrega.** Uma PR por tarefa, commit `[T-XXX] descrição`. Antes de finalizar: `node --check` em todo `.js` alterado; subir servidor estático (`python3 -m http.server`) e abrir as páginas sem erro no console (o Jules não tem login: telas autenticadas são conferidas pelo dono). Descrição da PR: (a) arquivos alterados, (b) o que foi omitido do protótipo e por quê, (c) checklist "como testar" com até 5 passos, (d) screenshot do que puder renderizar.

**Formatos:** datas `dd/mm/aaaa` (fuso America/Sao_Paulo), moeda `R$ 1.234,56`, números de tabela com `font-variant-numeric: tabular-nums`. Texto da interface em português do Brasil.

**Rotas:** `#dashboard`, `#catalogo`, `#meus-pedidos`, `#aprovacoes`, `#estoque`, `#relatorios`, `#usuarios`.

**Status de pedido (badge):** `PENDENTE` (atenção), `APROVADO` (informativo), `EM_SEPARACAO` (roxo), `ENTREGUE` (sucesso), `REJEITADO` (crítico), `CANCELADO` (cinza `--color-text-muted` sobre `--color-bg-main`). Cores em `DESIGN.md` seção 2. Sempre com o texto do status, nunca só a cor.

---

## CONTRATO DO BANCO (colar em toda tarefa)

O `schema.sql` implementa exatamente estes nomes. Todas as views respeitam a RLS de quem consulta. Usuário `diretoria` só lê. Usuário inativo só consegue ler o próprio perfil.

**Valores fixos (enums):** perfil `solicitante | almoxarife | gestor_ti | diretoria` · categoria `PAPELARIA | INFORMATICA | LIMPEZA | IMPRESSAO | OUTROS` · tipo do item `consumivel | permanente` · unidade `un | cx | pct | rl | lt | kg` · status do pedido `PENDENTE | APROVADO | EM_SEPARACAO | ENTREGUE | REJEITADO | CANCELADO` · movimentação `ENTRADA | SAIDA | AJUSTE | DESCARTE`.

**Tabelas (leitura direta):**
| Tabela | Colunas |
|---|---|
| `profiles` | `id, full_name, role, cost_center, active, created_at` |
| `items` | `id, name, sku, description, image_url, category, unit, type, location, reorder_point, requires_expiry, unit_price, active, created_at` |
| `batches` | `id, item_id, lot_number, expires_on, quantity_received, quantity_remaining, supplier, invoice_number, received_at, received_by` |
| `stock` | `item_id, quantity, updated_at` (item sem linha = saldo 0) |

`items` aceita `insert` e `update` direto de almoxarife/gestor_ti (desativar = `update active=false`, nunca delete). Nenhuma outra tabela recebe escrita direta do front.

**Views (somente leitura):**
| View | Conteúdo |
|---|---|
| `vw_stock_overview` | colunas de `items` + `quantity` (saldo físico total, inclui lote vencido), **`available_quantity`** (saldo que pode ser pedido e entregue: só lotes não vencidos), `stock_status` (`NORMAL`, `ABAIXO_MINIMO`, `SEM_ESTOQUE`, calculado sobre o disponível), `next_expiry`, `at_risk_batches` (lotes vencidos, a vencer ou parados) |
| `vw_alerts` | `alert_type` (`ESTOQUE_BAIXO`, `VALIDADE_PROXIMA`, `VENCIDO`, `LOTE_PARADO`), `item_id, item_name, sku, batch_id, lot_number, quantity, threshold, expires_on, received_at, days` (`days`: dias até vencer em `VALIDADE_PROXIMA`, dias de atraso em `VENCIDO`, dias em estoque em `LOTE_PARADO`, nulo em `ESTOQUE_BAIXO`) |
| `vw_requests` | colunas de `requests` (`id, requester_id, item_id, quantity, justification, cost_center, status, auto_approved, approved_by, approved_at, reject_reason, delivered_at, created_at, updated_at`) + `item_name, item_sku, item_unit, item_type, unit_price, total_value, requester_name, requester_cost_center` |
| `vw_approval_queue` | `vw_requests` filtrada em `PENDENTE` + `stock_quantity` (saldo atual), `recent_delivery_days` (dias desde a última entrega do mesmo item ao mesmo solicitante, nos últimos 180 dias; `null` se não houver) + `my_turn` (boolean: o perfil de quem consulta pode decidir este pedido, alçada RN-04) |
| `vw_delivery_history` | `requester_id, item_id, item_name, item_sku, delivered_at, days_ago` (pedidos `ENTREGUE`) |
| `vw_movements` | `id, item_id, item_name, sku, batch_id, lot_number, type, quantity, request_id, note, performed_by, performer_name, created_at` |
| `vw_consumption` | uma linha por saída: `moved_at, month, item_id, item_name, sku, category, requester_id, requester_name, cost_center, quantity, value` |
| `vw_audit` | `id, table_name, record_id, action, old_data, new_data, changed_by, user_name, changed_at` |

**Funções (RPC) — todas validam perfil, estado e saldo no banco:**
| Função | Parâmetros | Efeito |
|---|---|---|
| `create_requests` | `p_items jsonb` (`[{"item_id":"uuid","quantity":2}]`), `p_justification text`, `p_cost_center text` | Cria um pedido por item, atomicamente. Consumível nasce `APROVADO` (`auto_approved=true`); permanente nasce `PENDENTE`. Erros: pedido ativo do mesmo item (`23505`), quantidade acima do saldo, justificativa curta (< 10 caracteres) |
| `approve_request` | `p_request_id uuid` | `PENDENTE → APROVADO` (respeita alçada) |
| `reject_request` | `p_request_id uuid, p_reason text` | `PENDENTE → REJEITADO` (motivo obrigatório) |
| `cancel_request` | `p_request_id uuid` | `PENDENTE → CANCELADO` (só o próprio solicitante) |
| `start_separation` | `p_request_id uuid` | `APROVADO → EM_SEPARACAO` |
| `deliver_request` | `p_request_id uuid` | `EM_SEPARACAO → ENTREGUE`, baixa o saldo consumindo o lote de vencimento mais próximo; falha se faltar saldo ou só houver lote vencido |
| `receive_stock` | `p_item_id uuid, p_quantity int, p_lot text, p_expires_on date, p_supplier text, p_invoice text` | Cria lote e movimentação `ENTRADA` (validade obrigatória se o item exige) |
| `adjust_stock` | `p_item_id uuid, p_quantity int, p_note text` | Movimentação `AJUSTE` (quantidade com sinal, motivo obrigatório) |
| `discard_batch` | `p_batch_id uuid, p_quantity int, p_reason text` | Movimentação `DESCARTE` de um lote |
| `admin_list_users` | — | (gestor_ti) `id, full_name, email, role, cost_center, active, created_at` |
| `admin_update_profile` | `p_user_id uuid, p_role text, p_cost_center text, p_active boolean` | (gestor_ti) atualiza perfil; recusa auto-rebaixamento ou auto-desativação |

**Cadastro:** `supabase.auth.signUp({ email, password, options: { data: { full_name } } })` cria o perfil automaticamente como `solicitante` e **inativo**.

**Dados de demonstração já carregados:** 6 itens (papel, 2 toners, mouse, teclado, álcool) com lotes e estoque inicial, incluindo de propósito: teclado e toner Brother abaixo do mínimo, toner HP com lote a vencer em 45 dias e outro lote vencido, e toner Brother com lote parado há 150 dias. As movimentações iniciais não têm responsável (`performer_name` nulo): mostrar "Sistema".

---

# TAREFAS

## FASE 0 — Fundação

### T-001 — Estrutura, design system e página de conferência visual
**Protótipo/alvo:** `theme/DESIGN.md` (paleta, tipografia, componentes).
- Criar pastas `css/`, `js/`, `js/modules/`. Criar `css/tokens.css` com o bloco da seção 6 do `DESIGN.md` (sem alterar valores) e `css/components.css` com: reset, `body`, botões (`.btn`, `.btn-primary`, `.btn-secondary`, `.btn-danger`), campos (`.form-group`, `.form-label`, `.form-input`, `.form-select`, `.form-textarea`), cartão (`.card`), badges de status (uma classe por status), tabela (`.table` com cabeçalho `--color-brand-dark`), alertas, modal, toast, sidebar e topbar (estrutura), utilitários (`.text-center`, `.w-full`, `.mt-md`, etc.).
- Criar `js/config.js` (URL e chave publishable acima), `js/supabase.js` (cliente único, `supabase-js` v2 por CDN jsdelivr) e `js/ui.js` com `esc()`, `toast(msg, tipo)`, `openModal({title, body, actions})`, `formatDate()`, `formatDateTime()`, `formatMoney()`, `statusBadge(status)`, `emptyState(msg)`, `paginate(lista, pagina, tamanho=25)`.
- Criar `styleguide.html`: página que exibe todas as cores (com nome e hex), a escala tipográfica, botões, campos, badges de todos os status, uma tabela de exemplo, um cartão de métrica, um modal e um toast acionáveis por botão. É só para conferência visual; será removida na T-015.

**Como o dono verifica:** (depois de P-6) abrir `/styleguide.html`: fundo cinza-claro, botão primário azul `#007EA7`, cabeçalho de tabela `#003459`, fonte Inter, código em JetBrains Mono, os 6 badges de status com cores distintas. No F12 → Console, sem erros.

## FASE 1 — Acesso e estrutura do sistema

### T-002 — Login e criar conta
**Protótipo/alvo:** sem protótipo; seguir `DESIGN.md` (cartão centralizado sobre `--color-bg-main`, logo/nome "Materials Control").
- `index.html` com duas abas ou links: **Entrar** (e-mail, senha) e **Criar conta** (nome completo, e-mail, senha com no mínimo 6 caracteres, confirmação de senha).
- `js/auth.js`: `login()`, `signUp()`, `logout()`, `getSession()`, `loadProfile()`. Após `signIn`, ler o próprio perfil (`profiles` onde `id = auth uid`). Se `active = false`: fazer `signOut` e mostrar "Conta aguardando ativação pelo gestor de TI". Se ativo: ir para `app.html`. Mapear erros: "Invalid login credentials" → "E-mail ou senha incorretos"; e-mail já cadastrado → mensagem clara.
- Após criar conta com sucesso: mensagem "Conta criada. Aguarde a ativação pelo gestor de TI." (sem entrar no sistema).
- Se já houver sessão ativa ao abrir `index.html`, ir direto a `app.html`.
- `js/guards.js`: `requireAuth()` (sem sessão ou perfil inativo → `index.html`) retornando o perfil.
- `app.html` temporário: só o nome do usuário, o perfil e o botão Sair (será substituído na T-003).

**Como o dono verifica:** criar conta com e-mail novo → mensagem de aguardando ativação; tentar entrar com ela → recusado com a mensagem de ativação; entrar com o gestor (P-3) → chega ao `app.html` e vê o próprio nome e perfil `gestor_ti`; senha errada → "E-mail ou senha incorretos"; recarregar `app.html` mantém a sessão; abrir `app.html` em aba anônima → volta ao login.

### T-003 — Shell do app, roteador e menu por perfil
**Protótipo:** sidebar e barra superior de qualquer `screen.png`.
- Reescrever `app.html`: `<aside>` escura (`--color-brand-black`, 240 px) com logo/nome, itens com ícone Material Symbols, item ativo destacado e botão Sair; `<header>` com caminho ("Materiais e Suprimentos / tela"), nome, perfil e avatar com iniciais; `<main id="view-root">`.
- Menu: Dashboard (todos) · Catálogo & Requisição (solicitante, almoxarife, gestor_ti) · Meus Pedidos (idem) · Central de Aprovações (almoxarife, gestor_ti) · Controle de Estoque (almoxarife, gestor_ti, diretoria) · Relatórios & Auditoria (gestor_ti, diretoria) · Usuários (gestor_ti).
- `js/router.js`: lê o hash, confere se o perfil pode acessar a rota (senão mostra "Acesso restrito" na área principal), importa `js/modules/<tela>.js` e chama `render(container, ctx)`. Rota padrão `#dashboard`.
- Criar um módulo para cada rota que **carrega e mostra o título da tela com `emptyState("Disponível em breve")`**, exceto se a tarefa correspondente já tiver sido feita. Não renderizar busca global, sino de notificações nem seletor de unidade.

**Como o dono verifica:** logado como gestor, todos os 7 itens aparecem e cada clique troca a tela e o item ativo; como solicitante, o menu mostra só Dashboard, Catálogo e Meus Pedidos, e digitar `#aprovacoes` na URL mostra "Acesso restrito"; a aparência é a de sidebar escura e barra superior branca dos protótipos.

## FASE 2 — Catálogo e pedidos

### T-004 — Catálogo de itens
**Protótipo:** `cat_logo_e_requisi_o_materials_control/screen.png` (coluna esquerda).
- Rota `#catalogo`. Ler `vw_stock_overview` (apenas `active = true`). Cartão do item: imagem (`image_url`; se nula ou com erro de carregamento, bloco com o ícone Material Symbols da categoria), etiqueta `SKU` (JetBrains Mono) e chip da categoria, nome, descrição (2 linhas), faixa "Estoque disponível: N unidade" (usar `available_quantity`) e botão **Adicionar à requisição** (desabilitado com "Sem estoque" se `available_quantity` = 0).
- Cabeçalho da tela, campo de busca (nome, SKU, descrição), chips de categoria (Todos, Papelaria, Informática, Limpeza, Impressão, Outros) e contador "N itens encontrados". Filtros no cliente.
- O botão Adicionar guarda o item em um estado `cart` em memória (módulo `js/modules/cart.js` com `add`, `remove`, `setQuantity`, `clear`, `items`) e mostra toast; o painel do carrinho é a T-005.
- Omitir: "Filtros Avançados" e "Mais Requisitados".

**Como o dono verifica:** logado, `#catalogo` mostra os 6 itens de demonstração em cartões com SKU e saldo reais; buscar "toner" deixa 2 cartões; o chip "Informática" deixa mouse e teclado; item sem imagem mostra ícone da categoria, não imagem quebrada.

### T-005 — Carrinho e envio da requisição
**Protótipo:** `cat_logo_e_requisi_o_materials_control/screen.png` (coluna direita).
- Painel "Sua Requisição Atual" ao lado do catálogo (abaixo dos cartões em telas estreitas): lista dos itens (nome, SKU, categoria, remover, quantidade inteira ≥ 1 limitada a `available_quantity`), "Limpar", **centro de custo** (texto, pré-preenchido com `profile.cost_center`) e **justificativa** (contador `n/500`, mínimo 10 caracteres, obrigatória), botão **Enviar requisição**.
- Enviar = `rpc('create_requests', { p_items, p_justification, p_cost_center })`. Sucesso → limpar carrinho, toast e ir para `#meus-pedidos`. Se falhar, nenhum pedido é criado e o carrinho permanece.
- Erro `23505`: "Você já possui um pedido ativo deste item." Erro de saldo ou de justificativa: mostrar a mensagem do banco.
- **Aviso preventivo de duplicidade** (caixa informativa do protótipo): ao adicionar item **permanente**, consultar `vw_delivery_history` do próprio usuário para o item; se houver entrega nos últimos 180 dias, exibir "Você recebeu <item> há N dias. Explique na justificativa o motivo de um novo pedido." Não bloqueia.
- Omitir: "Salvar como rascunho", texto de prazo de aprovação, cartão de matrícula/nível do usuário.

**Como o dono verifica:** adicionar mouse (permanente) e resma (consumível), preencher justificativa e enviar → vai para Meus Pedidos; repetir o mesmo mouse mostra "Você já possui um pedido ativo"; justificativa com menos de 10 caracteres bloqueia o envio; pedir mais unidades que o saldo é recusado; pedir uma segunda vez a mesma resma (enquanto a primeira não foi entregue) também é recusado, pois vale para qualquer item (RN-01).

### T-006 — Meus Pedidos
**Protótipo:** sem protótipo; padrão de tabela da Central de Aprovações.
- Rota `#meus-pedidos`. `vw_requests` com `requester_id` do usuário, mais recentes primeiro, paginado (25). Colunas: ID curto (`#` + 6 primeiros caracteres, JetBrains Mono), data, item (com SKU), quantidade, status (badge), motivo da rejeição (destaque crítico quando `REJEITADO`), justificativa (truncada, texto completo em `title`).
- Abas por status com contadores: Todos, Pendentes, Aprovados, Em separação, Entregues, Rejeitados, Cancelados. Estado vazio com botão para `#catalogo`.
- Botão **Cancelar** nos pedidos `PENDENTE` (com confirmação) → `rpc('cancel_request')`.

**Como o dono verifica:** o pedido do mouse (T-005) aparece com badge "PENDENTE" e a resma como "APROVADO" (aprovação automática); cancelar o mouse muda para "CANCELADO" e permite pedir de novo; as abas filtram e os contadores batem.

## FASE 3 — Aprovação, estoque e entrega

### T-007 — Central de Aprovações
**Protótipo:** `central_de_aprova_es_materials_control/screen.png`.
- Rota `#aprovacoes` (almoxarife, gestor_ti). Cabeçalho e 4 cartões calculados por consulta real: **Pendentes de análise** (fila do perfil), **Alertas de duplicidade** (fila com `recent_delivery_days` não nulo), **Aprovadas hoje** (aprovações manuais, `auto_approved = false`, com a soma de `total_value`), **Rejeitadas no mês**.
- Abas com contadores: Todas, Pendentes, Com alerta de duplicidade, Aprovadas, Rejeitadas, Entregues. **Pendentes** e **Alerta** leem `vw_approval_queue` com `my_turn = true` (o banco decide a alçada; **não reimplementar**). As demais leem `vw_requests`.
- Tabela: ID e horário, solicitante (nome, centro de custo), item (quantidade × nome, SKU, saldo atual), justificativa, coluna de alerta (badge "Duplicidade detectada: recebeu há N dias" ou "Sem alertas"). Linha com alerta se expande e mostra o histórico de `vw_delivery_history` do solicitante para aquele item.
- **Aprovar** (confirmação) → `rpc('approve_request')`. **Rejeitar** → modal com motivo obrigatório → `rpc('reject_request')`. Depois de agir, refazer consultas e contadores.
- Omitir: "Regras de Auditoria Ativas", "Exportar Relatório do Turno", "Auditar em lote", "Aprovar condicionado", colunas de série/patrimônio.

**Como o dono verifica:** como almoxarife, o pedido do mouse aparece em Pendentes; aprovar muda o contador e ele aparece em Aprovadas; rejeitar sem motivo é impossível; rejeitar com motivo aparece em vermelho no Meus Pedidos do solicitante. Pedido de valor acima de R$ 200 (ex.: 6 mouses de R$ 35) **não** aparece para o almoxarife, mas aparece para o gestor.

### T-008 — Controle de Estoque: lista e cadastro de itens
**Protótipo:** `controle_de_estoque_materials_control/screen.png` (cabeçalho, cartões, filtros, tabela).
- Rota `#estoque` (almoxarife, gestor_ti; diretoria em modo leitura, sem botões de ação). Cartões: **Total de SKUs ativos**, **Valor do estoque** (Σ saldo × `unit_price`), **Abaixo do ponto de reposição**, **Lotes em risco** (Σ `at_risk_batches`). Leitura de `vw_stock_overview`.
- Filtros: busca (nome/SKU), categoria, status (Normal, Abaixo do mínimo, Sem estoque). Tabela paginada (25): SKU, produto (+descrição), categoria, localização, quantidade (`quantity`; vermelho se `stock_status` ≠ `NORMAL`; "0" em caixa crítica; se `available_quantity` for menor que `quantity`, mostrar ao lado "N vencidas"), ponto de reposição, próximo lote/validade, status.
- **"+ Novo item"** e **Editar** por linha abrem modal: nome, **SKU (obrigatório, 2 a 40 caracteres)**, descrição, categoria, unidade, tipo, localização, ponto de reposição (≥ 0), exige validade, preço unitário (**obrigatório se permanente**), URL da imagem (opcional). `insert`/`update` direto em `items`. **Desativar** = `update active=false`. Nome ou SKU duplicado (`23505`) com mensagem clara.
- Omitir: "Ajuste de inventário" e "+ Registrar entrada" (T-009), "Exportar relatório de auditoria", coluna "Responsável", filtro de localizações, cartão "Compras recomendadas".

**Como o dono verifica:** como almoxarife, `#estoque` lista os 6 itens com saldo real e marca em vermelho os abaixo do mínimo; criar um item novo o faz aparecer em `#catalogo`; desativar o faz sumir do catálogo; como solicitante, a tela é "Acesso restrito"; como diretoria, aparece sem botões.

### T-009 — Entrada, ajuste, descarte e histórico de movimentações
**Protótipo:** `controle_de_estoque_materials_control/screen.png` (botões do cabeçalho e tabela "Histórico de Movimentações Recentes").
- Em `#estoque` (almoxarife, gestor_ti): **"+ Registrar entrada"** → modal: item, quantidade (inteiro > 0), lote, validade (obrigatória se o item exige), fornecedor, nota fiscal → `rpc('receive_stock')`.
- **"Ajuste de inventário"** → modal: item, quantidade positiva ou negativa (≠ 0), motivo obrigatório → `rpc('adjust_stock')`.
- **Descarte:** ação por lote (lista de lotes do item, com validade e restante) → modal com quantidade e motivo → `rpc('discard_batch')`. Lotes vencidos ficam em destaque crítico.
- Seção **Histórico de movimentações** abaixo da tabela: últimas 20 de `vw_movements` (data/hora, tipo com ícone, item, quantidade com sinal, observação, responsável).
- Item que exige validade não aceita ajuste positivo (o banco recusa; a mensagem orienta a usar "Registrar entrada"): esconder a opção positiva para esses itens e ainda assim tratar o erro.
- Movimentação sem responsável (`performer_name` nulo) mostra "Sistema".
- Mostrar a mensagem do banco em qualquer erro.

**Como o dono verifica:** registrar entrada de 10 resmas → saldo sobe 10 e o histórico mostra "+10"; toner sem validade é recusado; ajuste de −999 mostra erro de saldo; descartar o lote de toner reduz o saldo e aparece como "Descarte" no histórico.

### T-010 — Separação e entrega
**Protótipo:** `central_de_aprova_es_materials_control/screen.png` (aba Aprovadas).
- Na aba **Aprovadas** da Central, incluir pedidos `APROVADO` e `EM_SEPARACAO` (badge roxo). Em `APROVADO`: **Iniciar separação** → `rpc('start_separation')`. Em `EM_SEPARACAO`: **Registrar entrega** (confirmação) → `rpc('deliver_request')`.
- Erro de saldo insuficiente ou de lote vencido: toast com a mensagem do banco; o pedido permanece `EM_SEPARACAO`.
- Após sucesso, atualizar a lista e os contadores; o pedido passa a aparecer em Entregues.

**Como o dono verifica:** o pedido da resma (aprovação automática) aparece em Aprovadas → iniciar separação → registrar entrega; no `#estoque` o saldo da resma cai e o histórico mostra a saída; no Meus Pedidos do solicitante o pedido fica "ENTREGUE". Um pedido maior que o saldo mostra erro e o saldo não muda.

## FASE 4 — Visão gerencial

### T-011 — Alertas e Dashboard por perfil
**Protótipo:** `dashboard_geral_materials_control/screen.png`.
- Rota `#dashboard`. **Almoxarife, gestor_ti, diretoria:** 4 cartões (Total em estoque = Σ saldos; SKUs em nível crítico com os 2 primeiros nomes; Lotes em risco de `vw_alerts` (validade próxima, vencido, parado); Fila de aprovação = pendentes do perfil), **gráfico de consumo mensal** dos últimos 6 meses por categoria a partir de `vw_consumption` (barras em CSS ou SVG, sem biblioteca, com legenda e rótulos de mês) e tabela **Últimas movimentações** (10 mais recentes de `vw_movements`). Painel de **Alertas** listando `vw_alerts` por tipo, com badge de tipo.
- **Solicitante:** cartões "Pendentes", "Em andamento" (aprovados e em separação) e "Entregues no mês", tabela dos 5 últimos pedidos (`vw_requests`) e botão "Nova requisição" → `#catalogo`.
- Omitir: "Custo por Departamento", "Exportar Relatório Mensal", "+3,2% mês", "Centro de custo ativo".

**Como o dono verifica:** como almoxarife/gestor, o total em estoque bate com a soma da tabela `stock` no Supabase; o toner com validade em 45 dias aparece em Alertas como "Validade próxima"; após uma entrega, o gráfico mostra barra no mês atual; como solicitante, vê só os próprios números.

### T-012 — Relatório de consumo
**Protótipo:** sem protótipo; padrão de filtros e tabela do Controle de Estoque.
- Rota `#relatorios`, aba **Consumo** (gestor_ti, diretoria). Filtros: período (início/fim), item, solicitante, centro de custo. Fonte: `vw_consumption`. Três agrupamentos alternáveis: por item, por solicitante, por centro de custo (quantidade e valor, com total geral). Tabela paginada.
- Botão **Exportar CSV** gerado no cliente: separador `;`, UTF-8 com BOM, cabeçalho em português, números e datas no formato brasileiro.

**Como o dono verifica:** depois das entregas de teste, o total por item bate com a soma das saídas; o CSV abre no Excel com acentos corretos e colunas separadas; almoxarife não acessa a tela.

### T-013 — Auditoria
**Protótipo:** sem protótipo; padrão de tabela e filtros.
- Em `#relatorios`, aba **Auditoria** (gestor_ti, diretoria). `vw_audit` paginado no servidor (`range` + contagem), filtros de tabela, usuário e período. Linha expansível com `old_data` e `new_data` em JSON formatado (via `textContent`), destacando os campos que mudaram.

**Como o dono verifica:** as ações feitas nas tarefas anteriores (criar item, aprovar, entregar, entrada) aparecem com o usuário certo; almoxarife não acessa; o log não tem botão de editar ou apagar.

### T-014 — Administração de usuários
**Protótipo:** sem protótipo; padrão de tabela.
- Rota `#usuarios` (gestor_ti). `rpc('admin_list_users')`: nome, e-mail, perfil, centro de custo, situação. Contas inativas ficam no topo com destaque "Aguardando ativação".
- Ações por linha em modal: **ativar/desativar**, **alterar perfil** (select dos 4 valores), **alterar centro de custo** → `rpc('admin_update_profile')`. Mostrar o erro do banco se tentar rebaixar ou desativar a si mesmo.
- Texto de apoio: novas contas são criadas pelo próprio colaborador em "Criar conta" e ficam aguardando ativação aqui.

**Como o dono verifica:** a conta criada em T-002 aparece como "Aguardando ativação"; ativá-la e trocá-la para almoxarife faz o login dela mostrar o menu de almoxarife; o gestor não consegue rebaixar a si mesmo; solicitante não acessa a tela.

## FASE 5 — Acabamento

### T-015 — Responsivo, estados, acessibilidade e limpeza
- Tablet e celular: sidebar vira gaveta com botão de menu; tabelas rolam na horizontal dentro do próprio contêiner; grade do catálogo em 1 a 2 colunas; carrinho abaixo dos cartões.
- Todas as telas: estado de carregamento e estado vazio; foco visível (`--color-brand-accent`); `label` em todo campo; `aria-label` em botão de ícone; modais fecham com Esc; status nunca só por cor.
- Limpeza: **remover `styleguide.html`**; garantir que não há `style="..."` inline (exceto valores calculados pelo JS), `console.log` de depuração ou texto de placeholder; escrever `README.md` com: o que é o sistema, link do site, como criar o primeiro gestor e a estrutura de pastas.

**Como o dono verifica:** abrir o site no celular e no desktop e navegar por todas as telas de cada perfil sem tela em branco sem explicação; F12 → nenhum elemento com `style` fixo nos HTML; `/styleguide.html` deixa de existir.

---

## Ordem
`P-1 a P-5 → T-001 → P-6 → T-002 → T-003 → T-004 → T-005 → T-006 → T-007 → T-008 → T-009 → T-010 → T-011 → T-012 → T-013 → T-014 → T-015`

## Checklist final
- [ ] Todas as tarefas verificadas no site publicado, com usuário de cada perfil
- [ ] O banco (não a tela) recusa o que cada perfil não pode fazer
- [ ] Os três problemas do caso resolvidos: saída de papel registrada, alerta de toner (validade e lote parado), pedido duplicado bloqueado e avisado
- [ ] Nenhum texto de placeholder, botão sem função ou CSS inline
