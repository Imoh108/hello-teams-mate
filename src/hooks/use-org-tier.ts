import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getOrgTier } from "@/lib/orgs.functions";
import { useCurrentOrgId } from "./use-current-org";
import type { SubscriptionTier } from "@/lib/tiers";

export function useOrgTier() {
  const [orgId] = useCurrentOrgId();
  const fn = useServerFn(getOrgTier);
  const [tier, setTier] = useState<SubscriptionTier | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!orgId) { setTier(null); return; }
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const t = (await fn({ data: { orgId } })) as { tier: SubscriptionTier };
        if (!cancelled) setTier(t.tier);
      } catch {
        if (!cancelled) setTier("basic");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [orgId, fn]);

  return { tier, loading, orgId };
}
