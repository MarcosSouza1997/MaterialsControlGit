---
name: Corporate Tech Logistics
colors:
  surface: '#f3fbff'
  surface-dim: '#c6dee9'
  surface-bright: '#f3fbff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#e5f6ff'
  surface-container: '#d9f2fd'
  surface-container-high: '#d4ecf7'
  surface-container-highest: '#cee6f2'
  on-surface: '#061e26'
  on-surface-variant: '#3f484e'
  inverse-surface: '#1d333c'
  inverse-on-surface: '#def4ff'
  outline: '#6f787f'
  outline-variant: '#bec8cf'
  surface-tint: '#006688'
  primary: '#006485'
  on-primary: '#ffffff'
  primary-container: '#007ea7'
  on-primary-container: '#fdfdff'
  inverse-primary: '#78d1fe'
  secondary: '#3a6188'
  on-secondary: '#ffffff'
  secondary-container: '#acd2ff'
  on-secondary-container: '#335a82'
  tertiary: '#00638a'
  on-tertiary: '#ffffff'
  tertiary-container: '#007dae'
  on-tertiary-container: '#fdfdff'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#c2e8ff'
  primary-fixed-dim: '#78d1fe'
  on-primary-fixed: '#001e2b'
  on-primary-fixed-variant: '#004d67'
  secondary-fixed: '#d0e4ff'
  secondary-fixed-dim: '#a4caf7'
  on-secondary-fixed: '#001d35'
  on-secondary-fixed-variant: '#20496f'
  tertiary-fixed: '#c6e7ff'
  tertiary-fixed-dim: '#83cfff'
  on-tertiary-fixed: '#001e2d'
  on-tertiary-fixed-variant: '#004c6b'
  background: '#f3fbff'
  on-background: '#061e26'
  surface-variant: '#cee6f2'
typography:
  display-lg:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 32px
    letterSpacing: -0.015em
  headline-md:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '600'
    lineHeight: 24px
    letterSpacing: 0em
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
    letterSpacing: 0em
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
    letterSpacing: 0em
  body-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
    letterSpacing: 0.01em
  label-md:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '600'
    lineHeight: 18px
    letterSpacing: 0.01em
  label-sm:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '700'
    lineHeight: 14px
    letterSpacing: 0.04em
  code-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.02em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 1rem
  gutter-lg: 1.5rem
  margin: 1.5rem
  margin-mobile: 1rem
  space-2xs: 0.125rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 0.75rem
  space-lg: 1rem
  space-xl: 1.5rem
  space-2xl: 2rem
---

## Brand & Style

The design system establishes an institutional, robust, and reliable aesthetic tailored for enterprise asset management, IT material requisition, and inventory control. Designed specifically for internal operational efficiency, it balances high information density with refined clarity.

### Personality & Core Attributes
- **Precise & Auditable:** Prioritizes structural order, clear traceability, unambiguous status tags, and strict visual verification safeguards (anti-duplicity alerts, audit-trail markers).
- **Executive & Grounded:** Employs a dominant spectrum of corporate deep blues and pristine whites to project operational security and stability.
- **Efficient & Decisive:** Avoids unnecessary ornamentation, ensuring technicians, inventory managers, and general corporate staff navigate catalog stocks, requisitions, and allocations without cognitive friction.

### Design Movement & Mood
- **Style:** Modern Corporate with Clean Data Density.
- **Atmosphere:** Clean contrast, crisp structural lines, soft rounded surfaces, and clear visual hierarchy designed for day-long enterprise workflows.

## Colors

The color system strictly adheres to the enterprise blue palette, structured to maintain WCAG AAA/AA legibility across data grids, cards, and navigation surfaces.

### Core Swatches
- **Azul Quase Preto (`#00171F`):** Dedicated to high-contrast typography, top headers, main sidebars, and critical system navigation shells.
- **Azul Escuro Profundo (`#003459`):** Applied to structural containers, secondary actions, section headers, modal banners, and table headers.
- **Azul Médio Oceano (`#007EA7`):** Primary action triggers, selected states, interactive icons, active pagination, and high-priority metrics.
- **Azul Claro Vibrante (`#00A8E8`):** Highlighting focus rings, micro-interactions, informational badges, alert highlights, and interactive hover states.
- **Branco Puro (`#FFFFFF`):** Base canvas for data tables, form inputs, modal viewports, card surfaces, and contrasted text against dark panels.

### Semantic & Audit Roles
- **Superfície Base:** `#F4F7F9` (fundo geral de aplicação) e `#FFFFFF` (painéis de cartões e formulários).
- **Divisores e Bordas:** `#E2E8F0` para linhas neutras; `#003459` para delimitadores primários.
- **Alerta e Auditoria (Anti-duplicidade):**
  - **Atenção / Duplicidade Pendente:** Superfície `#FFF7ED`, borda `#FDBA74`, texto `#9A3412`.
  - **Sucesso / Aprovado no Estoque:** Superfície `#ECFDF5`, borda `#6EE7B7`, texto `#065F46`.
  - **Alerta Crítico / Ruptura de Estoque:** Superfície `#FEF2F2`, borda `#FCA5A5`, texto `#991B1B`.

## Typography

Typography relies entirely on **Inter** to ensure maximum legibility across dense data interfaces, serial numbers, inventory SKUs, and tabular columns.

### Hierarchy & Usage Rules
- **Display & Headline Levels (`display-lg`, `headline-lg`):** Reserved for primary screen titles (ex: "Controle de Estoque", "Painel do Almoxarifado").
- **Section Headers (`headline-md`, `headline-sm`):** Applied to card containers, step indicators of requisitions, and audit drawer headers.
- **Body (`body-lg`, `body-md`, `body-sm`):** Standard reading text, item specifications (ex: "Mouse óptico USB 1600 DPI"), requisition notes, and user records.
- **Labels & Micro-copy (`label-md`, `label-sm`):** Table column headers, badge chips, anti-duplicity alerts, and form input headers (rendered in uppercase when using `label-sm`).
- **Code & Identifiers (`code-sm`):** Used for serial numbers, patrimony IDs, and transaction hashes.

## Layout & Spacing

The layout is built around a structured 12-column fluid grid system optimized for desktop workstations, warehouse tablets, and terminal interfaces.

### Grid & Density Hierarchy
- **Desktop (1024px+):** 12 columns, 240px fixed left sidebar (`#00171F`), fluid body area with `gutter-lg` (1.5rem) and `margin` (1.5rem).
- **Tablet (768px - 1023px):** 8 columns, collapsible navigation drawer, `gutter` (1rem).
- **Mobile (< 768px):** 4 columns, single-column reflow for inventory cards and requisition actions, `margin-mobile` (1rem).

### Vertical Rhythm
- Dense UI: Data tables and listing rows maintain a compact 40px–48px row height with `space-sm` vertical padding to ensure maximum data visibility above the fold.
- Generous UI: Form requisition flows ("Enviar Requisição") utilize `space-xl` step spacing to eliminate user fatigue and prevent input errors.

## Elevation & Depth

Visual hierarchy uses crisp surface layers paired with low-blur, structural shadows tinted with `#00171F` to preserve clean corporate boundaries without muddiness.

### Levels of Depth
- **Nível 0 (Base / Fundo):** Fundo neutro do sistema (`#F4F7F9`), sem elevação.
- **Nível 1 (Cartões, Tabelas e Painéis):** Superfície `#FFFFFF` com borda sutil de 1px em `#E2E8F0` e sombra leve: `0 1px 3px 0 rgba(0, 23, 31, 0.06), 0 1px 2px 0 rgba(0, 23, 31, 0.04)`.
- **Nível 2 (Dropdowns, Filtros Ativos e Painéis Suspensos):** Superfície `#FFFFFF`, sombra intermediária: `0 4px 6px -1px rgba(0, 23, 31, 0.08), 0 2px 4px -1px rgba(0, 23, 31, 0.04)`.
- **Nível 3 (Gavetas de Auditoria, Modais de Confirmação):** Superfície `#FFFFFF` sobreposta por backdrop `#00171F` a 50% de opacidade, com sombra profunda: `0 20px 25px -5px rgba(0, 23, 31, 0.15), 0 10px 10px -5px rgba(0, 23, 31, 0.08)`.

## Shapes

The design system adopts a balanced geometry (Level 2) that combines corporate precision with modern, accessible corner radii.

### Border Radius Application
- **Borda Base (`rounded-md`, 0.5rem / 8px):** Campos de texto, botões de ação, itens de menu lateral, células selecionáveis e badges.
- **Borda Intermediária (`rounded-lg`, 1rem / 16px):** Cartões de indicadores (KPIs), contêineres do Almoxarifado, painéis de listagem e tabelas de dados.
- **Borda Acentuada (`rounded-xl`, 1.5rem / 24px):** Modais de requisição, painéis de auditoria e blocos de destaque no topo das telas.
- **Pílula (`rounded-full`):** Exclusiva para contadores numéricos, avatares de Usuários e status de alerta rápido.

## Components

### 1. Botões & Ações
- **Primário ("Enviar Requisição", "Registrar Material"):**
  - Fundo `#00A8E8`, texto `#00171F` (peso 600) ou fundo `#007EA7` com texto `#FFFFFF`. Borda arredondada `rounded-md`, padding horizontal `1.25rem`, vertical `0.625rem`. Estado hover transita para `#003459` com texto branco.
- **Secundário ("Cancelar", "Exportar Relatório"):**
  - Fundo transparente ou `#FFFFFF`, borda de 1.5px sólida em `#003459`, texto `#003459`. Hover com preenchimento leve em `#003459` a 5% de opacidade.
- **Ação Rápida / Ícones (Telas de Estoque):**
  - Botão quadrado de 36px com cantos suaves, ícone centralizado em `#007EA7`.

### 2. Entradas de Dados (Inputs & Formulários)
- **Campos de Texto e Busca:** Fundo `#FFFFFF`, borda de 1px `#E2E8F0`, cantos `rounded-md`. Altura de 40px.
- **Estado de Foco:** Borda `#007EA7` com anel externo (focus ring) de 2px em `#00A8E8` com 40% de opacidade.
- **Legenda Superior:** `label-md` em `#00171F` com indicador obrigatório em vermelho institucional.

### 3. Badges de Status & Auditoria Anti-Duplicidade
- **Alerta Anti-Duplicidade:** Formato em pílula com borda de 1px. Exibe ícone de escudo/atenção, fundo `#FFF7ED`, borda `#FDBA74`, texto `#9A3412`. Indica itens que já constam em requisições ativas para o mesmo colaborador.
- **Status do Estoque:**
  - *Disponível:* Fundo `#ECFDF5`, texto `#065F46`.
  - *Em Análise / Almoxarifado:* Fundo `#EFF6FF`, borda `#BFDBFE`, texto `#1E40AF`.
  - *Esgotado:* Fundo `#FEF2F2`, borda `#FECACA`, texto `#991B1B`.

### 4. Cartões de Métricas e Itens (Mouses, Telas, Periféricos)
- Superfície branca pura (`#FFFFFF`), cantos `rounded-lg`, contorno neutro `1px solid #E2E8F0`.
- Cabeçalho estruturado com título em `#003459`, contagem em destaque com `display-lg`, subtítulo descritivo em `body-sm` (`#00171F` a 70%).

### 5. Tabelas Corporativas de Gestão
- **Cabeçalho:** Fundo `#003459`, texto `#FFFFFF` em `label-md`, padding de 12px 16px.
- **Linhas Alternadas:** Fundo branco com hover em `#F4F7F9`. Separadores horizontais finos de 1px em `#E2E8F0`.
- **Coluna de Ações:** Alinhada à direita, com botões diretos para "Registrar Saída", "Editar" e "Auditar".