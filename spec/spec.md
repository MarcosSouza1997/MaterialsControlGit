# SPEC — Materials Control v1.0
**Sistema interno de requisição e controle de insumos**
**Stack:** HTML5 / CSS3 / JavaScript (ES Modules, sem framework, sem build) · Supabase (Auth + PostgreSQL + RLS) · GitHub Pages
**Autor:** Gestão de TI · **Data:** 27/09/2026 · **Versão:** 1.0 (completa)
**Arquivos irmãos:** `spec/tasks.md`, `spec/schema.sql`, `theme/DESIGN.md`, `theme/stitch_remix_of_materials_control_ui/`

---

## 1. Contexto e problema

> A empresa está perdendo dinheiro. Não há controle sobre os insumos internos: resmas de papel somem, toners de impressora secam no estoque e mouses/teclados são solicitados em duplicidade. A diretoria chamou o Gestor de TI para planejar a criação de um software interno de requisição e controle desses materiais.

| # | Sintoma | Problema de negócio |
|---|---|---|
| P1 | Resmas de papel somem | Saídas sem registro: ninguém sabe quem levou, quanto, quando e para qual setor |
| P2 | Toners secam no estoque | Cartuchos ficam parados até vencer ou ressecar, sem alerta de validade nem de tempo em estoque |
| P3 | Mouses e teclados pedidos em duplicidade | Colaborador pede de novo um equipamento que já recebeu ou que já tem pedido em aberto |

**Causa raiz:** não existe um registro central com regras de pedido, aprovação e estoque em tempo real.

## 2. Objetivo e indicadores

Garantir **rastreabilidade total** do insumo, do pedido ao consumo, eliminando perdas e duplicidades.

| Indicador | Meta (6 meses) |
|---|---|
| Saídas de papel registradas (resolve P1) | 100% |
| Lotes de toner descartados por vencimento sem alerta prévio (P2) | 0 |
| Pedidos duplicados ativos por colaborador (P3) | 0 |
| Itens com saldo visível em tempo real | 100% |
| Tempo médio entre pedido e entrega | ≤ 48 h úteis |

## 3. Escopo

**Dentro (v1.0):** autenticação e cadastro com ativação, catálogo de itens, requisição com carrinho, aprovação por alçada, separação e entrega, controle de estoque com lotes e validade, alertas, dashboard por perfil, relatórios de consumo com exportação CSV, auditoria, administração de usuários.

**Fora (v1.0):** compras e fornecedores, orçamento por centro de custo, custo por departamento, transferência entre almoxarifados, devolução/recolhimento de equipamento, rascunho de requisição, busca global, notificações (e-mail, SMS, push), upload de imagem (a imagem do item é uma URL), aplicativo móvel nativo, tempo real (realtime).

---

## 4. Perfis e permissões

| Perfil (`role`) | Descrição |
|---|---|
| `solicitante` | Colaborador. Pede materiais e acompanha os próprios pedidos |
| `almoxarife` | Opera o estoque: cadastro de itens, entradas, separação, entrega, ajustes e descarte. Aprova pedidos de até R$ 200 |
| `gestor_ti` | Tudo que o almoxarife faz, mais: aprova pedidos acima de R$ 200, administra usuários e acessa relatórios e auditoria |
| `diretoria` | Somente leitura: dashboard, relatórios e auditoria |

| Ação | solicitante | almoxarife | gestor_ti | diretoria |
|---|:-:|:-:|:-:|:-:|
| Ver catálogo e saldo | ✔ | ✔ | ✔ | ✔ |
| Criar pedido | ✔ | ✔ | ✔ | — |
| Ver pedidos | só os seus | todos | todos | todos |
| Cancelar pedido pendente | os seus | — | — | — |
| Aprovar/rejeitar até R$ 200 | — | ✔ | ✔ | — |
| Aprovar/rejeitar acima de R$ 200 | — | — | ✔ | — |
| Separar e entregar | — | ✔ | ✔ | — |
| Cadastrar/editar itens | — | ✔ | ✔ | — |
| Entrada, ajuste, descarte | — | ✔ | ✔ | — |
| Ver movimentações de estoque | — | ✔ | ✔ | ✔ |
| Relatórios de consumo | — | — | ✔ | ✔ |
| Auditoria | — | — | ✔ | ✔ |
| Administrar usuários | — | — | ✔ | — |

**Toda permissão é imposta pelo banco (RLS e funções). O front apenas esconde opções; nunca é a fonte de verdade.**

---

## 5. Regras de negócio

| ID | Regra | Resolve |
|---|---|---|
| RN-01 | Um colaborador não pode ter mais de **um pedido ativo** (`PENDENTE`, `APROVADO` ou `EM_SEPARACAO`) do mesmo item. Bloqueio no banco, com mensagem clara na tela | P3 |
| RN-02 | Ao pedir um **item permanente** que o colaborador recebeu (`ENTREGUE`) nos últimos **180 dias**, o sistema **avisa** e exige justificativa detalhada. O aviso também aparece para quem aprova, com o histórico. Não bloqueia | P3 |
| RN-03 | **Item consumível** (papel, toner, limpeza): o pedido nasce `APROVADO`, marcado como *aprovação automática do sistema*. **Item permanente** (mouse, teclado, headset): nasce `PENDENTE` e exige aprovação | P1 |
| RN-04 | **Alçada:** valor do pedido = preço unitário × quantidade. Até **R$ 200,00** aprova almoxarife ou gestor_ti; **acima**, somente gestor_ti. A regra é aplicada no banco e a fila de cada perfil já vem filtrada | P3 |
| RN-05 | **Estados do pedido:** `PENDENTE → APROVADO → EM_SEPARACAO → ENTREGUE`; `PENDENTE → REJEITADO`; `PENDENTE → CANCELADO`. Nenhuma outra transição é permitida. Só o almoxarife/gestor_ti move para `EM_SEPARACAO` e `ENTREGUE` | P1 |
| RN-06 | **Rejeição exige motivo.** Cancelamento só pelo próprio solicitante e só enquanto `PENDENTE` | P3 |
| RN-07 | **O saldo nunca fica negativo** e só muda por **movimentação de estoque**. Movimentações não podem ser editadas nem apagadas | P1 |
| RN-08 | Toda **saída** para colaborador está vinculada a um pedido e só ocorre ao marcar o pedido `ENTREGUE`. **Ajuste** e **descarte** exigem motivo | P1 |
| RN-09 | Quantidade pedida é inteira e maior que zero, e **não pode exceder o saldo** no momento do pedido. A checagem definitiva ocorre na entrega | P1 |
| RN-10 | Itens marcados **"exige validade"** (toner) exigem **lote e validade** na entrada. A saída consome sempre o **lote de vencimento mais próximo** (FEFO). **Lote vencido nunca é entregue**: fica bloqueado até ser **descartado** | P2 |
| RN-11 | **Alertas:** (a) saldo ≤ ponto de reposição; (b) lote que vence em até **60 dias**; (c) lote **vencido**; (d) lote **parado**: recebido há mais de **120 dias** e ainda com saldo | P2 |
| RN-12 | **Auditoria imutável:** toda criação, alteração ou remoção em itens, pedidos, movimentações e perfis registra usuário, data/hora e valores antes/depois. O log não aceita edição nem exclusão, nem de administradores | P1 |
| RN-13 | **Contas novas** nascem `solicitante` e **inativas**. Só o gestor_ti ativa, altera perfil e centro de custo. Usuário inativo não acessa o sistema. O gestor_ti não pode desativar nem rebaixar a si mesmo | — |
| RN-14 | Itens **nunca são excluídos**, só desativados. Item desativado some do catálogo, mas mantém todo o histórico. Nome e SKU são únicos | P1 |
| RN-15 | Preço unitário é **obrigatório para item permanente** (base da alçada) e opcional para consumível (usado em relatórios) | — |

### Parâmetros (constantes do sistema)
| Parâmetro | Valor |
|---|---|
| Limite de alçada do almoxarife | R$ 200,00 |
| Janela de aviso de recebimento recente | 180 dias |
| Antecedência do alerta de validade | 60 dias |
| Lote parado | 120 dias |
| Itens por página | 25 |

---

## 6. Requisitos funcionais

### RF-01 — Autenticação e cadastro
- Login com e-mail e senha; sessão persiste ao recarregar; botão Sair.
- Tela **Criar conta** (nome completo, e-mail, senha). A conta fica *aguardando ativação* (RN-13); ao entrar, o usuário vê a mensagem "Conta aguardando ativação pelo gestor de TI".
- Mensagens de erro em português (ex.: "E-mail ou senha incorretos").
- **Aceite:** conta nova não acessa o painel até ser ativada; conta ativada entra e vê o menu do seu perfil; acessar `app.html` sem login redireciona para `index.html`.

### RF-02 — Gestão de itens (almoxarife, gestor_ti)
- Cadastrar, editar e desativar itens com os campos da seção 8.
- Validações: nome com 2 a 120 caracteres; ponto de reposição ≥ 0; preço obrigatório para permanente (RN-15); SKU e nome únicos (RN-14).
- **Aceite:** item criado aparece no catálogo e no controle de estoque; solicitante não vê botões de gestão e o banco recusa a tentativa.

### RF-03 — Catálogo e requisição (todos, exceto diretoria)
- Grade de cartões: imagem (ou ícone da categoria), SKU, categoria, nome, descrição curta, saldo e botão **Adicionar à requisição**. Item sem saldo aparece desabilitado.
- Busca por nome, SKU ou descrição; filtro por categoria.
- **Carrinho** ("Sua Requisição Atual"): quantidade por item limitada ao saldo, remover, limpar; centro de custo (preenchido com o do perfil) e justificativa obrigatória de no mínimo 10 caracteres. Enviar cria **um pedido por item**.
- Aviso de duplicidade (RN-02) ao adicionar item permanente recebido nos últimos 180 dias; bloqueio com mensagem se já houver pedido ativo (RN-01).
- **Aceite:** pedido duplicado do mesmo item é recusado sem quebrar a tela; consumível entra `APROVADO`, permanente entra `PENDENTE`.

### RF-04 — Meus pedidos
- Lista dos próprios pedidos: ID curto, data, item (com SKU), quantidade, status em badge colorido, motivo da rejeição e justificativa. Abas por status com contadores. Botão **Cancelar** nos pendentes.
- **Aceite:** pedido rejeitado mostra o motivo; pedido cancelado libera novo pedido do mesmo item.

### RF-05 — Central de aprovações (almoxarife, gestor_ti)
- Cartões de métricas: pendentes de análise, alertas de duplicidade, aprovadas hoje, rejeitadas no mês.
- Abas: Todas, Pendentes, Com alerta de duplicidade, Aprovadas, Rejeitadas, Entregues.
- A fila **Pendentes** mostra só os pedidos da alçada do perfil (RN-04). Cada linha: ID e horário, solicitante e centro de custo, item e saldo, justificativa, alerta de duplicidade com **histórico de entregas** expansível.
- Ações: **Aprovar** e **Rejeitar** (modal com motivo obrigatório).
- **Aceite:** almoxarife não vê pedido acima de R$ 200; rejeição sem motivo é impossível; a ação atualiza a fila e o Meus Pedidos do solicitante.

### RF-06 — Separação e entrega (almoxarife, gestor_ti)
- Na aba **Aprovadas**: **Iniciar separação** (`APROVADO → EM_SEPARACAO`) e **Registrar entrega** (`EM_SEPARACAO → ENTREGUE`).
- A entrega gera a saída de estoque (consumindo lote FEFO, RN-10) e é uma operação única: ou faz tudo ou nada.
- **Aceite:** entrega maior que o saldo mostra a mensagem de erro e não altera nada; entrega correta baixa o saldo e o pedido vira `ENTREGUE`.

### RF-07 — Controle de estoque (almoxarife, gestor_ti; diretoria somente leitura)
- Cartões: total de SKUs ativos, valor do estoque, itens abaixo do ponto de reposição, lotes em risco.
- Tabela: SKU, produto, categoria, localização, quantidade atual, ponto de reposição, próximo lote/validade, status (Normal, Abaixo do mínimo, Sem estoque, Lote em risco). Filtros por busca, categoria e status.
- **Registrar entrada:** item, quantidade, lote, validade (obrigatória se exigida), fornecedor, nota fiscal.
- **Ajuste de inventário:** quantidade positiva ou negativa, motivo obrigatório.
- **Descarte:** lote e quantidade, motivo (vencimento, defeito, ressecado).
- **Histórico de movimentações:** data/hora, tipo, item, quantidade com sinal, observação e responsável.
- **Aceite:** entrada de 10 resmas soma 10 ao saldo e aparece no histórico; toner sem validade é recusado; ajuste que zeraria abaixo de zero é recusado.

### RF-08 — Alertas
- Estoque baixo, lote a vencer (≤ 60 dias), lote vencido e lote parado (RN-11), visíveis no dashboard e no controle de estoque.
- **Aceite:** toner com validade em 45 dias aparece em "a vencer"; lote vencido aparece bloqueado e disponível para descarte.

### RF-09 — Dashboard por perfil
- **Almoxarife, gestor_ti, diretoria:** total em estoque, itens em nível crítico, lotes em risco, fila de aprovação, **gráfico de consumo mensal** dos últimos 6 meses por categoria e tabela das últimas movimentações.
- **Solicitante:** seus pedidos pendentes, em andamento e entregues, os 5 últimos pedidos e atalho para nova requisição.
- **Aceite:** os números batem com o banco; o solicitante nunca vê dados de outros usuários.

### RF-10 — Relatório de consumo (gestor_ti, diretoria)
- Filtros: período, item, solicitante e centro de custo. Agrupamento por item, solicitante e centro de custo, com quantidade e valor.
- **Exportar CSV** (separador `;`, codificação UTF-8 com BOM para abrir corretamente no Excel).
- **Aceite:** totais conferem com a soma das saídas do período; acentuação correta no Excel.

### RF-11 — Auditoria (gestor_ti, diretoria)
- Tabela paginada do log: data/hora, usuário, tabela, ação, resumo. Linha expansível com valores antes e depois. Filtros por tabela, usuário e período.
- **Aceite:** cada ação de RF-02 a RF-07 e RF-12 aparece com o usuário certo; solicitante não acessa.

### RF-12 — Administração de usuários (gestor_ti)
- Lista de usuários: nome, e-mail, perfil, centro de custo, situação. Ações: **ativar/desativar**, **alterar perfil**, **alterar centro de custo**. Contas aguardando ativação ficam em destaque.
- **Aceite:** usuário desativado é deslogado na próxima carga; mudança de perfil muda o menu no próximo login; gestor não consegue rebaixar a si mesmo.

---

## 7. Requisitos não funcionais

| ID | Requisito |
|---|---|
| RNF-01 | Front 100% estático em GitHub Pages; nenhum servidor próprio |
| RNF-02 | Toda segurança no Supabase (RLS e funções). Funções de banco para operações compostas (entrega, entrada) |
| RNF-03 | Telas carregam em até 2 s; listas paginadas com 25 itens |
| RNF-04 | Visões (views) do banco respeitam a RLS do usuário que consulta |
| RNF-05 | Responsivo: desktop é prioridade; utilizável em tablet e celular (sidebar vira gaveta) |
| RNF-06 | JavaScript em ES Modules e Supabase JS v2 por CDN; **sem framework, sem Tailwind, sem CSS inline** |
| RNF-07 | Todo texto vindo do banco é escapado antes de ir para o HTML (prevenção de XSS) |
| RNF-08 | Visual conforme `theme/DESIGN.md` (cores, fontes Inter e JetBrains Mono, ícones Material Symbols). Cores só por variável CSS |
| RNF-09 | Interface e mensagens em português do Brasil; datas em `dd/mm/aaaa`, moeda `R$ 1.234,56`, fuso `America/Sao_Paulo` |
| RNF-10 | Acessibilidade básica: rótulo em todo campo, foco visível, `aria-label` em botões de ícone, contraste conforme `DESIGN.md`, status nunca só por cor |
| RNF-11 | Chrome, Edge e Firefox (2 últimas versões) |
| RNF-12 | Nenhuma tela com botão sem função ou texto de "em desenvolvimento" |

---

## 8. Modelo de dados (conceitual)

O `spec/schema.sql` implementa exatamente este modelo. **Todo campo mostrado nas telas do Stitch tem uma coluna aqui.**

**Categorias:** Papelaria, Informática, Limpeza, Impressão, Outros. **Unidades:** `un`, `cx`, `pct`, `rl`, `lt`, `kg`.

| Entidade | Campos principais |
|---|---|
| **Perfil** (`profiles`) | id (= usuário do Auth), nome completo, perfil, centro de custo, ativo, criado em |
| **Item** (`items`) | id, nome, **SKU**, **descrição**, **URL da imagem**, categoria, unidade, tipo (`consumivel`/`permanente`), **localização**, ponto de reposição, exige validade, preço unitário, ativo |
| **Lote** (`batches`) | id, item, número do lote, validade, quantidade recebida, **quantidade restante**, **fornecedor**, **nota fiscal**, recebido em, recebido por |
| **Saldo** (`stock`) | item, quantidade total (mantida pelas movimentações) |
| **Pedido** (`requests`) | id, solicitante, item, quantidade, justificativa, centro de custo, status, aprovação automática, aprovado por, aprovado em, motivo da rejeição, entregue em, criado em, atualizado em |
| **Movimentação** (`stock_movements`) | id, item, lote, tipo (`ENTRADA`, `SAIDA`, `AJUSTE`, `DESCARTE`), quantidade com sinal, pedido (obrigatório na saída), motivo/observação, responsável, data |
| **Auditoria** (`audit_log`) | id, tabela, registro, ação, dados antes, dados depois, usuário, data |

**Visões e funções exigidas no banco:** alertas de estoque e validade (RN-11), fila de aprovação por alçada (RN-04), histórico de entregas por usuário e item (RN-02), entrega atômica de pedido (RF-06) e entrada atômica de estoque (RF-07). Registro de conta nova cria o perfil inativo automaticamente (RN-13).

---

## 9. Telas e protótipos

Os protótipos ficam em `theme/stitch_remix_of_materials_control_ui/`; cada pasta tem `screen.png` (alvo visual) e `code.html` (estrutura de referência em Tailwind, **não copiar**: reescrever com as classes do projeto). O design system está em `theme/stitch_remix_of_materials_control_ui/corporate_tech_logistics/DESIGN.md` e em `theme/DESIGN.md`.

| Tela | Rota | Perfis | Protótipo (pasta do Stitch) |
|---|---|---|---|
| Login e criar conta | `index.html` | público | **a gerar** (seguir o `DESIGN.md`) |
| Dashboard | `#dashboard` | todos | `dashboard_geral_materials_control` |
| Catálogo & Requisição | `#catalogo` | solicitante, almoxarife, gestor_ti | `cat_logo_e_requisi_o_materials_control` |
| Meus Pedidos | `#meus-pedidos` | solicitante, almoxarife, gestor_ti | **a gerar** |
| Central de Aprovações | `#aprovacoes` | almoxarife, gestor_ti | `central_de_aprova_es_materials_control` |
| Controle de Estoque | `#estoque` | almoxarife, gestor_ti (diretoria leitura) | `controle_de_estoque_materials_control` |
| Relatórios & Auditoria | `#relatorios` | gestor_ti, diretoria | **a gerar** |
| Usuários | `#usuarios` | gestor_ti | **a gerar** |

**Estrutura comum:** sidebar escura de 240 px com logo, menu por perfil e botão Sair; barra superior com caminho, nome e perfil do usuário.

**Elementos dos protótipos que NÃO entram na v1.0** (não têm dado nem fluxo): busca global da barra superior, sino de notificações, seletor de unidade/almoxarifado, versão do sistema, "Custo por Departamento", "Exportar Relatório Mensal/do Turno", "Regras de Auditoria Ativas", "Auditar em lote", "Aprovar condicionado a devolução", "Salvar como rascunho", "Filtros Avançados", "Mais Requisitados", transferência interna, recolhimento de bem, nº de série/patrimônio, cartão de matrícula do usuário. As imagens dos cartões do protótipo são ilustrativas: no sistema a imagem vem da URL do item, com ícone da categoria como reserva.

---

## 10. Arquitetura e repositório

```
Navegador (GitHub Pages: HTML/CSS/JS)  ──HTTPS──►  Supabase (Auth · PostgreSQL + RLS · funções)
        chave publishable                              regras de negócio e segurança
```

```
/
├── README.md
├── index.html            (login e criar conta)
├── app.html              (shell do sistema)
├── spec/                 spec.md · tasks.md · schema.sql
├── theme/                DESIGN.md · stitch_remix_of_materials_control_ui/
├── css/                  tokens.css · components.css
└── js/                   config.js · supabase.js · auth.js · guards.js · router.js · ui.js · modules/
```

- Só a **URL do projeto** e a chave **publishable** vão em `js/config.js`. Chave secret e senha do banco **nunca** entram no repositório.
- Roteamento por hash (`#dashboard`, `#catalogo`, …); cada tela é um módulo em `js/modules/`.

## 11. Configuração inicial do Supabase (premissas)
1. Projeto criado com **Data API** ligada e **RLS automática** ligada.
2. Em Authentication, **desligar "Confirm email"** (a ativação é feita pelo gestor_ti, RN-13).
3. Rodar `spec/schema.sql` no SQL Editor.
4. Criar o primeiro usuário em Authentication → Users e promovê-lo a `gestor_ti` e ativo por SQL (único passo manual; os demais são feitos pela tela Usuários).
5. Criar um usuário de teste para cada perfil.

---

## 12. Rastreabilidade: problema → solução

| Problema | Regras | Funcionalidades | Telas |
|---|---|---|---|
| **P1** Papel some | RN-03, RN-05, RN-07, RN-08, RN-12 | RF-03, RF-06, RF-07, RF-11 | Catálogo, Aprovações, Estoque, Auditoria |
| **P2** Toner seca | RN-10, RN-11 | RF-07, RF-08, RF-09 | Estoque, Dashboard |
| **P3** Duplicidade | RN-01, RN-02, RN-04 | RF-03, RF-05 | Catálogo, Aprovações |

## 13. Definition of Done (por funcionalidade)
- [ ] Funciona no site publicado, com dado real do Supabase, sem erro no console
- [ ] O visual segue o protótipo do Stitch e o `DESIGN.md`
- [ ] Testada com um usuário de cada perfil; o banco (não a tela) recusa o que o perfil não pode fazer
- [ ] Erro tratado com mensagem em português; nenhuma tela travada em "Carregando..."
- [ ] Ação gera registro de auditoria
- [ ] Sem CSS inline, sem texto de placeholder, sem botão sem função

## 14. Riscos e mitigações
| Risco | Mitigação |
|---|---|
| Colaboradores retiram material sem pedir | Política interna + auditoria periódica do consumo contra o estoque físico |
| Chave publishable exposta | É pública por natureza; a segurança está na RLS. Testar cada tabela com cada perfil |
| Views expondo dados fora da RLS | RNF-04: views com `security_invoker` e sem acesso do papel anônimo |
| Dois almoxarifes mexendo no mesmo saldo | Operações atômicas no banco com trava de linha |
| Escopo maior que o prazo | Entregar por camadas: autenticação → catálogo e pedido → aprovação e entrega → estoque → dashboard → relatórios, auditoria e usuários |

---
*Documento vivo. Próximos: `spec/tasks.md` (plano de execução) e `spec/schema.sql` (banco).*
