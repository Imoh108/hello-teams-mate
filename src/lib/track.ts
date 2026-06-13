import { trackEvent } from "@/lib/platform.functions";

/** Fire-and-forget client analytics helper. Safe to call from any component. */
export function track(
  eventType: string,
  properties?: Record<string, any>,
  orgId?: string | null
) {
  try {
    void trackEvent({
      data: { eventType, properties, orgId: orgId ?? null },
    }).catch(() => {});
  } catch {
    /* swallow */
  }
}
