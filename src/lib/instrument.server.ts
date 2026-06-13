/**
 * Server-side instrumentation helpers. Records latency / errors into
 * analytics_events via the admin client. Fire-and-forget; never throws.
 */
export async function recordPerf(op: string, ms: number, extra?: Record<string, any>) {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("analytics_events").insert({
      event_type: "_perf",
      properties: { op, ms: Math.round(ms), ...(extra ?? {}) },
    });
  } catch { /* swallow */ }
}

export async function recordError(op: string, err: unknown, extra?: Record<string, any>) {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const message = err instanceof Error ? err.message : String(err);
    await supabaseAdmin.from("analytics_events").insert({
      event_type: "_error",
      properties: { op, message: message.slice(0, 500), ...(extra ?? {}) },
    });
  } catch { /* swallow */ }
}

/** Wrap an async handler with timing + error capture. */
export async function instrument<T>(op: string, fn: () => Promise<T>): Promise<T> {
  const t0 = Date.now();
  try {
    const result = await fn();
    void recordPerf(op, Date.now() - t0);
    return result;
  } catch (e) {
    void recordPerf(op, Date.now() - t0, { failed: true });
    void recordError(op, e);
    throw e;
  }
}
