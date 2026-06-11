# resumed. — CLAUDE.md

Plataforma de e-commerce de resumos de medicina. Stack: React 18 via CDN + Babel Standalone + Supabase + Vercel. **Não há build step, bundler, npm run build, nem node_modules no runtime.**

## Arquitetura

### Frontend — React CDN sem build step
O app inteiro é servido como arquivos estáticos pelo Vercel. Não existe bundler.

- `index.html` — carrega todas as dependências via `<script>` CDN com SRI hashes, depois carrega os `.jsx` como `type="text/babel"`. O Babel Standalone transpila em runtime no browser.
- `supabase.js` — inicializa `window.sb` (cliente Supabase) e expõe `window.SUPABASE_URL` / `window.SUPABASE_ANON_KEY`.
- `tweaks-panel.jsx` — sistema de theming (paletas, dark mode, densidade, tipografia, estilo de card). Expõe `useTweaks()`.
- `shared.jsx` — componentes de UI reutilizáveis (Nav, Footer, Toast, Modal, etc.).
- `data.jsx` — toda a camada de dados Supabase (queries, uploads, Edge Function calls). Expõe funções via `window.*`.
- `auth.jsx` — login, cadastro, recuperação de senha, hook `useAuth()`.
- `pages.jsx` — páginas públicas (landing, catálogo, produto, carrinho, checkout, suporte, etc.).
- `library.jsx` — biblioteca do usuário, leitor de PDF protegido (PDF.js + watermark + anti-piracy).
- `admin.jsx` — painel administrativo (upload de produtos, gestão de usuários, suporte, vendas).
- `app.jsx` — roteador principal, `<App>` montado em `#root`.

### Backend — Supabase Edge Functions (Deno/TypeScript)
Em `supabase/functions/`:
- `create-mp-preference` — cria preferência Mercado Pago; valida usuário, busca preços do DB (nunca do cliente), registra em `pending_payments`.
- `mercadopago-webhook` — recebe notificações do MP, confirma pagamento, cria registro em `purchases`, dispara email.
- `send-email` — envia emails via Resend. **Requer `Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>`** — apenas chamadas internas são aceitas.
- `save-device-fingerprint` — registra fingerprint de dispositivo em `access_logs`.
- `create-checkout`, `create-pix-charge`, `abacatepay-webhook` — integrações alternativas de pagamento.

### Banco de dados — Supabase/PostgreSQL 15
Projeto ref: `tlaoalfnzykrdwwlvmpq`. Migrations são SQL patches numerados (`supabase-patch-N.sql`), aplicados via `supabase db query --linked --file`.

Tabelas principais: `products`, `purchases`, `pending_payments`, `profiles`, `support_tickets`, `ticket_replies`, `access_logs`, `terms_acceptance`, `error_logs`.

Views: `sales_with_user`, `user_activity_summary` — ambas têm `security_invoker = on`.

---

## Regras de desenvolvimento

### JSX / Frontend

**Nunca use `import` ou `require` nos arquivos `.jsx`.** Não há bundler. Tudo que precisar de lib externa deve já estar carregado no `index.html` como CDN. Os globals disponíveis nos `.jsx` são:
- `React`, `ReactDOM` — React 18
- `window.sb` — cliente Supabase
- `window.SUPABASE_URL`, `window.SUPABASE_ANON_KEY`
- `pdfjsLib` — PDF.js
- `window.Sentry` — monitoramento de erros

**Cache bust obrigatório.** Ao modificar qualquer `.jsx`, incremente o `?v=N` correspondente em `index.html`. O Vercel serve arquivos estáticos com cache agressivo.

```html
<!-- Exemplo: ao editar pages.jsx, mude ?v=7 para ?v=8 -->
<script type="text/babel" src="pages.jsx?v=8"></script>
```

**SRI hashes** — ao atualizar versão de qualquer CDN em `index.html`, recalcule o hash:
```bash
curl -s <URL> | openssl dgst -sha384 -binary | openssl base64 -A
```

### Edge Functions

**CORS** — todas as funções usam uma allowlist explícita, nunca `*`:
```typescript
const ALLOWED_ORIGINS = ["https://resumosmed.com", "https://resumosmed.com.br"];
```

**json() helper** — deve ser declarado como closure dentro de `Deno.serve()`, não no escopo do módulo, pois depende de `origin` que é calculado por request.

**Preços** — `create-mp-preference` busca preços diretamente do banco. Nunca confiar em valores vindos do cliente.

**send-email** — qualquer chamada interna ao `send-email` deve passar `Authorization: Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`. A função rejeita tudo que não seja a service role key.

Deploy de uma função específica:
```bash
export SUPABASE_ACCESS_TOKEN="<token>"
supabase functions deploy <nome-da-funcao> --project-ref tlaoalfnzykrdwwlvmpq
```

### Banco de dados / RLS

**Row Level Security é a principal linha de defesa.** Todo acesso de usuário comum ao banco passa pelo JWT do Supabase. Regras:

- Toda tabela nova deve ter `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`.
- Policies de escrita precisam de `WITH CHECK`, não só `USING`.
- Views que fazem join de tabelas protegidas devem ter `security_invoker = on`:
  ```sql
  ALTER VIEW public.nome_da_view SET (security_invoker = on);
  ```
- A função helper `is_admin()` existe no banco — use-a nas policies de admin.
- Nunca confiar em campos como `is_admin`, `role` ou `user_id` enviados pelo cliente sem reforço via RLS `WITH CHECK`.

Aplicar um patch SQL:
```bash
export SUPABASE_ACCESS_TOKEN="<token>"
supabase db query --linked --file supabase-patch-N.sql
```

---

## Segurança — regras inegociáveis

1. **Nunca usar `new Function()`, `eval()` ou `Babel.transform()` com input externo.** O admin panel não aceita mais TSX — só JSON.
2. **Nunca expor service role key no frontend.** Apenas Edge Functions a usam, via variável de ambiente Supabase.
3. **`send-email` é interno.** Sempre valida `Authorization: Bearer <service_role_key>` antes de qualquer processamento.
4. **Preços vêm do banco.** `create-mp-preference` ignora valores do payload do cliente.
5. **`completionUrl` tem allowlist.** Só aceita `resumosmed.com` e `resumosmed.com.br` como hostname.
6. **Uploads de arquivo**: `data.jsx > createProduct` verifica `file.type === "application/pdf"`. Nunca aceitar outros tipos.

---

## Deploy

### Frontend (Vercel)
O push para `main` dispara deploy de produção automaticamente via GitHub integration. Para forçar um deploy manual:
```bash
vercel --prod
```

### Edge Functions
Não são deployadas automaticamente pelo GitHub. Requerem deploy explícito via CLI após mudanças:
```bash
export SUPABASE_ACCESS_TOKEN="<token>"
supabase functions deploy <funcao> --project-ref tlaoalfnzykrdwwlvmpq
```

### SQL Migrations
Não há migrations automáticas. Escrever `supabase-patch-N.sql` e aplicar manualmente:
```bash
supabase db query --linked --file supabase-patch-N.sql
```

---

## Domínios e IDs

| Recurso | Valor |
|---------|-------|
| Produção | `https://resumosmed.com` / `https://www.resumosmed.com` |
| Supabase project ref | `tlaoalfnzykrdwwlvmpq` |
| Supabase URL | `https://tlaoalfnzykrdwwlvmpq.supabase.co` |
| Vercel project | `resumosmed` (org: `pedroprojects`) |
| GitHub | `https://github.com/PedroCaravellos/resumosmed` (branch: `main`) |

---

## Theming

O sistema de theming é controlado por CSS custom properties em `index.html` e pelos atributos `data-*` no `<html>`:
- `data-dark="true"` — dark mode
- `data-density="compact|regular|comfy"` — densidade
- `data-type="modern|editorial|serious"` — tipografia
- `data-card="soft|outline|sticker"` — estilo de card

Paleta ativa é aplicada via `--primary`, `--acc-1..4` no `:root` por `applyPalette()` em `app.jsx`.

---

## Armadilhas conhecidas

- **Cache do Vercel** — sem bumpar `?v=N` no `index.html`, usuários antigos continuam rodando a versão anterior do `.jsx`.
- **Babel Standalone** — transpila JSX em runtime. `unsafe-eval` e `unsafe-inline` são obrigatórios no CSP por causa disso. Não há alternativa sem migrar para um build step.
- **json() fora do Deno.serve()** — qualquer helper que referencia `CORS` ou `origin` calculados por request deve ser closure dentro do handler, não no escopo do módulo.
- **Triggers de email** — INSERT em `support_tickets` dispara `fn_email_ticket_opened()` via `pg_net`. Em ambientes de dev/teste, se `app.service_role_key` não estiver configurado, o INSERT vai falhar com erro de trigger.
- **Anon key é pública** — a `SUPABASE_ANON_KEY` em `supabase.js` é intencional e segura; a proteção real é RLS no banco, não obscuridade da chave.
