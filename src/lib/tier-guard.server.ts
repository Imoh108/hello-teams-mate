import type { SupabaseClient } from "@supabase/supabase-js";
import type { SubscriptionTier } from "@/lib/tiers";

// Server-side guard: throws if the org does not have the required tier.
// Uses the security-definer SQL helper so RLS / membership doesn't matter here —
// the underlying RLS on writes is still the source of truth.
export async function requireTier(
  supabase: SupabaseClient<any>,
  orgId: string | null | undefined,
  min: SubscriptionTier
) {
  if (!orgId) throw new Error(`Upgrade required: ${min} (no organization selected)`);
  const { data, error } = await supabase.rpc("org_has_tier", { _org: orgId, _min: min });
  if (error) throw new Error(error.message);
  if (!data) throw new Error(`Upgrade required: this feature is only available on the ${min} plan or higher.`);
}
