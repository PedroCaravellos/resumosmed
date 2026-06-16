// Helper compartilhado de observabilidade pras Edge Functions.
// Antes disso, erros do backend só existiam em console.log (logs do Supabase,
// pouco confiáveis pra consulta — ver CLAUDE.md "Armadilhas conhecidas").
// Agora "error"/"fatal" também vão pro Sentry automaticamente, mantendo o
// mesmo formato JSON estruturado que cada function já usava.
import * as Sentry from "https://esm.sh/@sentry/deno@10.58.0";

let initialized = false;

function getSentry() {
  const dsn = Deno.env.get("SENTRY_DSN");
  if (!dsn) return null;
  if (!initialized) {
    Sentry.init({ dsn, environment: "production", tracesSampleRate: 0 });
    initialized = true;
  }
  return Sentry;
}

// Dispara o flush em background (EdgeRuntime.waitUntil) pra não atrasar a
// resposta HTTP — se não existir (ambiente local), só deixa a promise rodar.
function backgroundFlush(sentry: typeof Sentry) {
  const flush = sentry.flush(2000).catch(() => {});
  try {
    (globalThis as unknown as { EdgeRuntime?: { waitUntil?: (p: Promise<unknown>) => void } })
      .EdgeRuntime?.waitUntil?.(flush);
  } catch { /* ambiente sem EdgeRuntime.waitUntil — segue mesmo assim */ }
}

export type LogLevel = "info" | "warn" | "error" | "fatal";

// Mesma assinatura de log(level, event, data) que cada function já usava —
// troque o `function log(...)` local por `const log = makeLogger("nome")`.
export function makeLogger(serviceName: string) {
  return function log(level: LogLevel, event: string, data: Record<string, unknown> = {}) {
    console.log(JSON.stringify({ level, ts: new Date().toISOString(), service: serviceName, event, ...data }));
    if (level !== "error" && level !== "fatal") return;
    const sentry = getSentry();
    if (!sentry) return;
    try {
      sentry.withScope(scope => {
        scope.setTag("service", serviceName);
        scope.setLevel(level === "fatal" ? "fatal" : "error");
        scope.setExtras(data);
        sentry.captureMessage(`${serviceName}: ${event}`);
      });
      backgroundFlush(sentry);
    } catch { /* telemetria nunca deve quebrar a resposta */ }
  };
}

// Pra blocos catch(err) de exceção não-prevista (stacktrace real, não só uma mensagem).
export function captureException(serviceName: string, err: unknown, extra: Record<string, unknown> = {}) {
  console.error(JSON.stringify({
    level: "fatal", ts: new Date().toISOString(), service: serviceName, event: "unhandled_exception",
    error: err instanceof Error ? err.message : String(err), ...extra,
  }));
  const sentry = getSentry();
  if (!sentry) return;
  try {
    sentry.withScope(scope => {
      scope.setTag("service", serviceName);
      scope.setExtras(extra);
      sentry.captureException(err instanceof Error ? err : new Error(String(err)));
    });
    backgroundFlush(sentry);
  } catch { /* telemetria nunca deve quebrar a resposta */ }
}
