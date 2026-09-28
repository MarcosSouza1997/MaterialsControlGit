# DESIGN.md — Materials Control

Sistema interno de requisição e controle de insumos. Interface corporativa, densa em dados, para uso diário em desktop e tablet. Prioridades: **legibilidade de tabelas e números, status inequívocos, poucos elementos decorativos.**

---

## 1. Paleta principal (5 cores)

| Token | Nome | Hex | Uso |
|---|---|---|---|
| `--color-brand-black` | Azul Quase Preto | `#00171F` | Sidebar, texto principal, títulos de alto contraste |
| `--color-brand-dark` | Azul Escuro Profundo | `#003459` | Cabeçalho de tabelas, títulos de cartões, ação secundária, bordas primárias |
| `--color-brand-primary` | Azul Médio Oceano | `#007EA7` | Botão primário, item ativo, links, ícones interativos |
| `--color-brand-accent` | Azul Claro Vibrante | `#00A8E8` | Anel de foco, hover, realces, item ativo na sidebar |
| `--color-brand-white` | Branco Puro | `#FFFFFF` | Cartões, tabelas, campos, texto sobre fundo escuro |

### Regras de contraste (calculadas, WCAG)

| Combinação | Razão | Pode usar em |
|---|---|---|
| Branco sobre `#00171F` | 18,4 : 1 | Qualquer texto |
| Branco sobre `#003459` | 12,8 : 1 | Qualquer texto (cabeçalho de tabela) |
| Branco sobre `#007EA7` | 4,6 : 1 | Texto de botão primário (AA) |
| `#00171F` sobre `#00A8E8` | 6,8 : 1 | Texto sobre o azul vibrante |
| **Branco sobre `#00A8E8`** | **2,7 : 1** | **Nunca** — reprovado |
| `#007EA7` sobre `#FFFFFF` | 4,6 : 1 | Links e ícones sobre cartão branco |
| **`#007EA7` sobre `#F4F7F9`** | **4,3 : 1** | **Evitar para texto pequeno** — use `#003459` |

Consequências práticas: o azul vibrante `#00A8E8` é usado como **fundo com texto escuro**, como **anel de foco** ou como **destaque sobre a sidebar escura**, nunca como fundo com texto branco.

---

## 2. Cores complementares (funcionais)

Não fazem parte da identidade, mas o sistema precisa delas para estados. Cada status usa **fundo claro + borda + texto escuro**, nunca cor sólida com texto branco.

### Neutros
| Token | Hex | Uso |
|---|---|---|
| `--color-bg-main` | `#F4F7F9` | Fundo geral da aplicação |
| `--color-surface` | `#FFFFFF` | Cartões, tabelas, modais |
| `--color-border-subtle` | `#E2E8F0` | Divisores e bordas de campos |
| `--color-text-main` | `#00171F` | Texto principal |
| `--color-text-muted` | `#3F4E58` | Texto secundário (8,6 : 1 sobre branco) |

### Status
| Uso | Fundo | Borda | Texto |
|---|---|---|---|
| Atenção / PENDENTE / estoque baixo / duplicidade | `#FFF7ED` | `#FDBA74` | `#9A3412` |
| Sucesso / ENTREGUE / estoque normal | `#ECFDF5` | `#6EE7B7` | `#065F46` |
| Crítico / REJEITADO / sem estoque / vencido | `#FEF2F2` | `#FCA5A5` | `#991B1B` |
| Informativo / APROVADO | `#EFF6FF` | `#BFDBFE` | `#1E40AF` |
| EM_SEPARACAO | `#F5F3FF` | `#C4B5FD` | `#5B21B6` |

Todos os pares texto/fundo acima passam de 6,8 : 1. Nunca comunique status **só pela cor**: sempre acompanhe de texto ("PENDENTE") ou ícone.

---

## 3. Tipografia

### Famílias
| Função | Fonte | Por quê |
|---|---|---|
| **Interface (tudo)** | **Inter** | Desenhada para telas e texto denso; numerais tabulares; excelente em tamanhos pequenos; ampla cobertura de acentos do português |
| **Códigos** (SKU, ID de pedido, lote, nota fiscal) | **JetBrains Mono** | Monoespaçada com distinção clara entre `0/O` e `1/l/I`, essencial para conferir códigos |

Alternativas seguras já instaladas nos sistemas, caso o Google Fonts esteja bloqueado na rede da empresa: `-apple-system, "Segoe UI", Roboto, Arial` e `ui-monospace, Consolas, monospace`.

### Carregamento
```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@500&display=swap" rel="stylesheet">
```
Só os pesos usados (Inter 400/500/600/700 e JetBrains Mono 500), para carregar rápido.

### Escala
| Nível | Tamanho / linha | Peso | Uso |
|---|---|---|---|
| `display` | 32 / 40 px | 700 | Números grandes de cartões de métrica |
| `title` | 24 / 32 px | 700 | Título da tela |
| `heading` | 18 / 26 px | 600 | Título de cartão ou seção |
| `subheading` | 16 / 24 px | 600 | Subseções, nome do item em cartão |
| `body` | 14 / 20 px | 400 | Texto padrão, células de tabela |
| `body-sm` | 12 / 16 px | 400 | Legendas, texto de apoio |
| `label` | 13 / 18 px | 600 | Rótulo de campo |
| `overline` | 11 / 14 px | 700, MAIÚSCULAS, espaçamento +0,04em | Cabeçalho de tabela, etiquetas de categoria |
| `code` | 12 / 16 px | 500, JetBrains Mono | SKU, ID, lote |

### Regras
- **Números em tabelas e métricas:** `font-variant-numeric: tabular-nums` para que colunas de quantidade e valor fiquem alinhadas.
- Tamanho mínimo de texto: **12 px**. Nada de 10 px.
- Títulos usam `--color-brand-dark` ou `--color-brand-black`; texto de apoio usa `--color-text-muted`.
- Sem itálico, sem sublinhado decorativo (só em links).
- Valores monetários no formato brasileiro: `R$ 1.234,56`.

---

## 4. Forma, espaço e profundidade

| Item | Valor |
|---|---|
| Raio de campos, botões e badges | 8 px |
| Raio de cartões e tabelas | 16 px |
| Raio de modais | 24 px |
| Pílula (contadores, status) | 9999 px |
| Escala de espaço | 2, 4, 8, 12, 16, 24, 32 px |
| Sidebar (desktop) | 240 px, fundo `#00171F` |
| Altura de campo / botão | 40 px |
| Altura de linha de tabela | 44–48 px |

Sombras com tom azul escuro, nunca cinza puro:
- Cartão: `0 1px 3px rgba(0,23,31,.06), 0 1px 2px rgba(0,23,31,.04)`
- Menu suspenso: `0 4px 6px -1px rgba(0,23,31,.08), 0 2px 4px -1px rgba(0,23,31,.04)`
- Modal: `0 20px 25px -5px rgba(0,23,31,.15), 0 10px 10px -5px rgba(0,23,31,.08)` sobre fundo `rgba(0,23,31,.5)`

---

## 5. Componentes

| Componente | Especificação |
|---|---|
| **Botão primário** | Fundo `#007EA7`, texto branco, peso 600; hover `#003459`; foco: anel 3 px `#00A8E8` a 40% |
| **Botão secundário** | Fundo transparente, borda 1,5 px `#003459`, texto `#003459`; hover com fundo `#003459` a 5% |
| **Botão de perigo** | Fundo `#991B1B`, texto branco, só para rejeitar/desativar |
| **Campo** | Fundo branco, borda 1 px `#E2E8F0`, raio 8 px; foco: borda `#007EA7` + anel `#00A8E8` |
| **Cabeçalho de tabela** | Fundo `#003459`, texto branco, estilo `overline` |
| **Linha de tabela** | Fundo branco, divisor `#E2E8F0`, hover `#F4F7F9` |
| **Badge de status** | Pílula com fundo, borda e texto da tabela de Status (seção 2), estilo `overline` |
| **Item ativo da sidebar** | Fundo `#007EA7`, texto branco (ou texto `#00A8E8` sobre fundo transparente) |
| **Cartão de métrica** | Fundo branco, borda `#E2E8F0`, raio 16 px, número em `display`, legenda em `body-sm` |

### Ícones
Material Symbols Outlined, peso 400, tamanho 20 px, cor herdada do texto. Ícone de ação sozinho sempre com `aria-label`.

---

## 6. Tokens prontos para `css/tokens.css`

```css
:root {
  /* Paleta principal */
  --color-brand-black:   #00171F;
  --color-brand-dark:    #003459;
  --color-brand-primary: #007EA7;
  --color-brand-accent:  #00A8E8;
  --color-brand-white:   #FFFFFF;

  /* Neutros */
  --color-bg-main:       #F4F7F9;
  --color-surface:       #FFFFFF;
  --color-border-subtle: #E2E8F0;
  --color-text-main:     #00171F;
  --color-text-muted:    #3F4E58;

  /* Status */
  --color-warning-bg: #FFF7ED; --color-warning-border: #FDBA74; --color-warning: #9A3412;
  --color-success-bg: #ECFDF5; --color-success-border: #6EE7B7; --color-success: #065F46;
  --color-danger-bg:  #FEF2F2; --color-danger-border:  #FCA5A5; --color-danger:  #991B1B;
  --color-info-bg:    #EFF6FF; --color-info-border:    #BFDBFE; --color-info:    #1E40AF;
  --color-purple-bg:  #F5F3FF; --color-purple-border:  #C4B5FD; --color-purple:  #5B21B6;

  /* Tipografia */
  --font-family: 'Inter', -apple-system, 'Segoe UI', Roboto, Arial, sans-serif;
  --font-mono:   'JetBrains Mono', ui-monospace, Consolas, monospace;

  /* Espaço */
  --space-2xs: 0.125rem; --space-xs: 0.25rem; --space-sm: 0.5rem; --space-md: 0.75rem;
  --space-lg: 1rem;      --space-xl: 1.5rem;  --space-2xl: 2rem;

  /* Forma */
  --radius-md: 0.5rem; --radius-lg: 1rem; --radius-xl: 1.5rem; --radius-full: 9999px;

  /* Sombras */
  --shadow-sm: 0 1px 3px rgba(0,23,31,.06), 0 1px 2px rgba(0,23,31,.04);
  --shadow-md: 0 4px 6px -1px rgba(0,23,31,.08), 0 2px 4px -1px rgba(0,23,31,.04);
  --shadow-lg: 0 20px 25px -5px rgba(0,23,31,.15), 0 10px 10px -5px rgba(0,23,31,.08);
}
```

---

## 7. Regras gerais
1. Cor nunca é hexadecimal solto no HTML ou no CSS de componente: sempre `var(--token)`.
2. Nada de `style="..."` inline.
3. Uma única família de interface (Inter) e uma monoespaçada (JetBrains Mono). Sem terceira fonte.
4. Cor sólida com texto branco só nos três azuis escuros da paleta e no vermelho de perigo. Os demais status usam fundo claro e texto escuro.
