# Materials Control

Sistema web interno para gestão, requisição e controle de estoque de insumos e materiais (papelaria, informática, limpeza, impressão e outros).

**Link da aplicação:** [https://marcossouza1997.github.io/MaterialsControlGit/](https://marcossouza1997.github.io/MaterialsControlGit/)

---

## 1. O que é o sistema e o problema que resolve

O **Materials Control** resolve os gargalos comuns da gestão de almoxarifado corporativo:
- **Requisições descontroladas e sem rastreabilidade:** Automação do fluxo de pedidos por centro de custo com alçadas claras de aprovação.
- **Perda de insumos por vencimento ou obsolescência:** Controle rígido de lotes com regra FEFO (*First Expire, First Out* - primeiro que vence é o primeiro que sai) e alertas de validade próxima e lotes parados.
- **Duplicidade e pedidos desnecessários:** Aviso prévio ao solicitante e alertas visuais para aprovadores quando há entregas recentes do mesmo item.
- **Falta de transparência e histórico:** Registro auditável imutável de todas as movimentações físicas e ações administrativas.

---

## 2. Perfis de Usuário e Permissões

O sistema possui 4 perfis com permissões específicas validadas diretamente no banco de dados via Supabase RLS (*Row Level Security*):

1. **Solicitante (`solicitante`):**
   - Acessa o Catálogo para solicitar insumos e o painel Meus Pedidos para acompanhar status e cancelar requisições pendentes.
2. **Almoxarife (`almoxarife`):**
   - Aprova requisições dentro de sua alçada, inicia separação e registra entregas físicas.
   - Gerencia itens do estoque, registra entrada de novos lotes, realiza ajustes de inventário físico e descartes.
3. **Gestor de TI (`gestor_ti`):**
   - Acesso irrestrito a todas as funcionalidades do sistema.
   - Administra contas de usuários (ativação, alteração de perfil e centro de custo).
   - Analisa relatórios de consumo, exportação CSV e histórico de auditoria.
4. **Diretoria (`diretoria`):**
   - Perfil de consulta gerencial (somente leitura). Visualiza dashboards, estoque, relatórios de consumo e auditoria.

---

## 3. Principais Regras de Negócio (RN)

- **Alçada de R$ 200,00:**
  - Almoxarifes podem aprovar solicitações cujo valor total seja de até R$ 200,00. Solicitações de valor superior exigem aprovação de um Gestor de TI.
- **Aprovação Automática de Consumíveis:**
  - Itens do tipo `consumivel` com valor total até R$ 200,00 nascem com status `APROVADO` (`auto_approved = true`). Itens `permanente` ou consumíveis acima de R$ 200,00 nascem como `PENDENTE`.
- **Prevenção de Duplicidade:**
  - O banco impede requisições simultâneas ativas do mesmo item pelo mesmo usuário (`23505`).
  - Avisa o solicitante e alerta os aprovadores quando houver entrega do mesmo item nos últimos 180 dias.
- **FEFO e Validade Obrigatória:**
  - A entrega de materiais consome prioritariamente o lote não vencido com data de validade mais próxima.
  - Lotes vencidos não são contabilizados no saldo disponível para pedidos.
- **Auditoria Imutável:**
  - Todas as alterações e movimentações geram registros imutáveis na tabela de auditoria (`vw_audit`).

---

## 4. Como Configurar o Supabase

1. Crie um projeto no [Supabase](https://supabase.com).
2. No menu **SQL Editor**, execute o arquivo `spec/schema.sql` completo para criar tabelas, views, triggers, políticas de RLS e funções RPC.
3. Em **Authentication -> Sign In / Providers -> Email**, desative a opção **"Confirm email"**.

---

## 5. Como Criar o Primeiro Gestor de TI

1. Abra o site da aplicação ([https://marcossouza1997.github.io/MaterialsControlGit/](https://marcossouza1997.github.io/MaterialsControlGit/)) e crie uma nova conta em **Criar conta**.
2. No Supabase, vá em **SQL Editor** e execute o seguinte comando substituindo o nome pelo nome cadastrado:

```sql
update public.profiles
set role = 'gestor_ti', active = true
where full_name = 'Seu Nome Completo';
```

---

## 6. Estrutura de Pastas

```
.
├── css/
│   ├── components.css    # Classes de componentes, layout e utilitários
│   ├── dashboard.css     # Estilos da visão geral gerencial
│   ├── relatorios.css    # Estilos de relatórios de consumo
│   ├── tokens.css        # Variáveis CSS do Design System (cores, fontes, espaçamentos)
│   └── usuarios.css      # Estilos do painel de administração de usuários
├── js/
│   ├── modules/          # Módulos ES das telas (renderizadores)
│   │   ├── aprovacoes.js
│   │   ├── auditoria-tab.js
│   │   ├── cart.js
│   │   ├── catalogo.js
│   │   ├── dashboard.js
│   │   ├── estoque.js
│   │   ├── meus-pedidos.js
│   │   ├── relatorios.js
│   │   └── usuarios.js
│   ├── auth.js           # Funções de autenticação Supabase
│   ├── config.js         # Configurações de API Supabase
│   ├── guards.js         # Rotas e guardas de autenticação
│   ├── router.js         # Roteador SPA baseado em hash
│   ├── supabase.js       # Inicialização do cliente Supabase JS
│   └── ui.js             # Helpers globais (esc, toast, openModal, formatUnit, etc.)
├── spec/                 # Especificações técnicas e schema SQL (read-only)
├── theme/                # Paleta de cores, tipografia e protótipos visuais (read-only)
├── app.html              # Shell da aplicação autenticada (Sidebar + Topbar + Layout)
├── favicon.svg           # Ícone da aplicação
├── index.html            # Tela de Login e Cadastro
└── README.md             # Documentação do projeto
```

---

## 7. Tecnologias Utilizadas

- **HTML5 e CSS3 Nativo:** Design System modular baseado em variáveis CSS (Design Tokens), sem bibliotecas ou frameworks CSS como Tailwind ou Bootstrap.
- **JavaScript ES Modules (Vanilla JS):** Arquitetura desacoplada e sem frameworks frontend (React/Vue/Angular).
- **Supabase JS v2 (via CDN):** Autenticação, Banco de Dados PostgreSQL, Row Level Security (RLS) e Funções RPC.
- **Material Symbols Outlined & Google Fonts (Inter e JetBrains Mono):** Tipografia e iconografia.
