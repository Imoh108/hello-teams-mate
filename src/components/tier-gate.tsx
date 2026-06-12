import { Link } from "@tanstack/react-router";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useOrgTier } from "@/hooks/use-org-tier";
import { hasTier, TIER_LABEL, type SubscriptionTier } from "@/lib/tiers";

interface Props {
  min: SubscriptionTier;
  children: React.ReactNode;
}

export function TierGate({ min, children }: Props) {
  const { tier, loading, orgId } = useOrgTier();
  if (loading || (orgId && tier === null)) {
    return <div className="p-8 text-muted-foreground text-sm">Checking subscription…</div>;
  }
  if (!orgId) {
    return <div className="p-8 text-muted-foreground text-sm">Select an organization first.</div>;
  }
  if (hasTier(tier, min)) return <>{children}</>;
  return (
    <div className="glass-panel rounded-xl p-8 text-center max-w-xl mx-auto mt-8">
      <div className="size-12 rounded-full bg-surface-2 grid place-items-center mx-auto mb-4">
        <Lock className="size-6 text-muted-foreground" />
      </div>
      <h2 className="font-display text-xl font-bold mb-2">
        {TIER_LABEL[min]} feature
      </h2>
      <p className="text-muted-foreground text-sm mb-5">
        Your organization is on the <span className="font-semibold">{tier ? TIER_LABEL[tier] : "Basic"}</span> plan.
        Upgrade to {TIER_LABEL[min]} to unlock this area.
      </p>
      <Button asChild>
        <Link to="/admin/upgrade">View plans</Link>
      </Button>
    </div>
  );
}
