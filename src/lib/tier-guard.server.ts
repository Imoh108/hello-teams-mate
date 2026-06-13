import type { SupabaseClient } from "@supabase/supabase-js";
import { PRELAUNCH_UNLOCK_ALL, type SubscriptionTier } from "@/lib/tiers";

// Server-side guard: throws if the org does not have the required tier.
// During PRELAUNCH_UNLOCK_ALL this is a no-op so every feature is reachable.
export async function requireTier(
  supabase: SupabaseClient<any>,
  orgId: string | null | undefined,
  min: SubscriptionTier
) {
  if (PRELAUNCH_UNLOCK_ALL) return;
  if (!orgId) throw new Error(`Upgrade required: ${min} (no organization selected)`);
  const { data, error } = await supabase.rpc("org_has_tier", { _org: orgId, _min: min });
  if (error) throw new Error(error.message);
  if (!data) throw new Error(`Upgrade required: this feature is only available on the ${min} plan or higher.`);
}

