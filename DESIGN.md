# resumosmed — Design System

## Stack técnica
- React 18 via CDN + Babel standalone (sem build step, sem npm, sem TypeScript)
- CSS em `index.html` dentro de `<style>` tag
- Componentes usam JSX inline styles (`style={{...}}`)
- Fontes via Google Fonts (preconnect já configurado)
- Sem framework CSS (zero Tailwind, Bootstrap, etc.)

## CSS Custom Properties (tokens)

### Cores
```css
--bg: #FAF6EF          /* creme quente — fundo da página */
--surface: #FFFFFF     /* branco — cards, modais */
--fg: #1B1A17          /* quase-preto quente — texto principal */
--muted: #6E6A60       /* cinza médio — texto secundário */
--line: #E8E1D4        /* borda sutil */
--line-strong: #DDD3BF /* borda mais forte */
--primary: #FF6B5B     /* coral — CTA, destaque */
--primary-ink: #FFFFFF /* texto sobre primary */
--acc-1: #FFD66B       /* amarelo destaque */
--acc-2: #7BC47F       /* verde menta — sucesso */
--acc-3: #B5A6F0       /* lavanda — categorias */
--acc-4: #6FB6E0       /* azul céu — info */
```

### Dark mode (data-dark="true")
```css
--bg: #15140F --surface: #1E1C16 --fg: #F5EFE2 --muted: #9D998A
--line: #2B2820 --line-strong: #3A362A
```
**PROBLEMA CONHECIDO:** `--line` (#2B2820) tem contraste ~1.2:1 sobre `--bg` (#15140F) — bordas quase invisíveis no dark mode.

### Espaçamento
```css
--pad-page: clamp(24px, 4vw, 64px)  /* padding horizontal da página */
--gap-xl: 96px | --gap-lg: 56px | --gap-md: 24px | --gap-sm: 14px | --gap-xs: 8px
--card-pad: 22px                    /* padding interno de cards */
--hero-pad-y: 80px                  /* padding vertical do hero */
```

### Border radius
```css
--radius-lg: 22px | --radius-md: 14px | --radius-sm: 9px
```

### Sombras
```css
--shadow-card: 0 1px 0 rgba(0,0,0,.02), 0 10px 30px -16px rgba(35,30,15,.18)
--shadow-pop:  0 1px 0 rgba(0,0,0,.02), 0 22px 50px -22px rgba(35,30,15,.30)
```

## Tipografia

### Fontes carregadas
- Bricolage Grotesque: 400–800, optical sizing 12–96px
- Manrope: 400–700
- Instrument Serif: regular + italic
- DM Serif Display: regular
- Geist: 400–600
- Geist Mono: 400–500

### Classes utilitárias
```css
.display { font-family: var(--font-display); font-weight: 600; letter-spacing: -0.02em; line-height: 1; }
.serif   { font-family: var(--font-accent); font-style: italic; font-weight: 400; }
.mono    { font-family: var(--font-mono); font-feature-settings: "ss01","tnum"; letter-spacing: -0.01em; }
```

## Componentes principais

### Botões (.btn)
```css
.btn      { display: inline-flex; align-items: center; gap: 8px; padding: 12px 18px;
            border-radius: 999px; border: 1px solid var(--line-strong);
            background: var(--surface); color: var(--fg); font-weight: 600; font-size: 14px; }
.btn:hover { transform: translateY(-1px); }
.btn.primary { background: var(--primary); color: var(--primary-ink); border-color: var(--primary); }
.btn.ghost   { background: transparent; border-color: transparent; }
.btn.lg      { padding: 16px 22px; font-size: 15px; }
```

### Cards (.card)
3 variantes via atributo `data-card`:
- `soft` (default): `background: surface; border: 1px solid --line; border-radius: --radius-lg; box-shadow: --shadow-card`
- `outline`: `background: transparent; border: 1.5px solid --line-strong; border-radius: --radius-md`
- `sticker`: `background: surface; border: 1.5px solid --fg; border-radius: --radius-lg; box-shadow: 6px 6px 0 --fg` (com leve rotação em nth-child)

### Pills (.pill)
```css
.pill { display: inline-flex; align-items: center; gap: 6px; padding: 5px 11px;
        border-radius: 999px; border: 1px solid var(--line); font-size: 12px; font-weight: 500; }
```

### Input (.input)
Sem classe global — estilizado inline nos componentes.

## Breakpoints responsivos

```css
@media (max-width: 1024px) { /* tablet */ }
@media (max-width: 768px)  { /* mobile nav: hamburguer, esconder .nav-links */ }
@media (max-width: 640px)  { /* mobile layout: texto centralizado, botões empilhados */ }
```

## Problemas conhecidos — mobile

### Alta prioridade
1. **Hero h1 muito grande**: `clamp(46px, 7.6vw, 104px)` — mínimo 46px pode ser pesado em 320px
2. **Stats grid trunca texto**: `repeat(2, auto)` pode cortar "R$ 10 a partir de" em telas <360px
3. **Card padding sem override mobile**: `--card-pad: 22px` em telas pequenas fica pesado
4. **Touch targets pequenos**: Footer links 14px sem padding extra — abaixo de 44px recomendado
5. **Dark mode bordas invisíveis**: `--line` quase mesmo tom que `--bg` no dark

### Média prioridade
6. **Hero subtitle sem faixa tablet**: 19px desktop → 16px mobile (sem transição suave 768–1024px)
7. **Áreas grid cards pequenos**: 5→3→2 colunas — em 2 colunas os cards ficam muito comprimidos
8. **Gaps hard-coded**: vários componentes usam valores fixos em vez de `var(--gap-*)`, não respondem à densidade

### Baixa prioridade
9. **Animações hero pesadas em mid-range Android**: 6 itens staggered a 0.75s cada
10. **CTA Banner padding**: poderia ser mais compacto em mobile sem perder impacto

## Variações de densidade (data-density)
- `compact`:  gaps -30%, card-pad 16px, hero-pad-y 56px, radius-lg 18px
- `regular`:  (padrão)
- `comfy`:    gaps +35%, card-pad 28px, hero-pad-y 112px, radius-lg 28px

## Variações de tipografia (data-type)
- `modern`:   Bricolage Grotesque (display) + Manrope (body) — default
- `editorial`: Instrument Serif (display) + Manrope (body)
- `serious`:  DM Serif Display (display) + Geist (body)
