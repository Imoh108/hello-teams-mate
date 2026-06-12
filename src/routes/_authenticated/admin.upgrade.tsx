import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useCurrentOrgId } from "@/hooks/use-current-org";
import { getOrgTier, setOrgTier, listMembers } from "@/lib/orgs.functions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, X, Sparkles, Crown, Zap } from "lucide-react";
import { toast } from "sonner";
import { TIER_MATRIX, TIER_LABEL, type SubscriptionTier } from "@/lib/tiers";

export const Route = createFileRoute("/_authenticated/admin/upgrade")({
  head: () => ({ meta: [{ title: "Plans — QuizPulse Admin" }] }),
  component: UpgradePage,
});

const TIERS: { id: SubscriptionTier; icon: any; tagline: string }[] = [
  { id: "basic", icon: Zap, tagline: "Casual play & engagement" },
  { id: "premium", icon: Sparkles, tagline: "Corporate training & AI" },
  { id: "enterprise", icon: Crown, tagline: "Secure global scaling" },
];

function UpgradePage() {
  const [orgId] = useCurrentOrgId();
  const getTier = useServerFn(getOrgTier);
  const setTier = useServerFn(setOrgTier);
  const membersFn = useServerFn(listMembers);
  const [tier, setLocalTier] = useState<SubscriptionTier | null>(null);
  const [isOwner, setIsOwner] = useState(false);
  const [saving, setSaving] = useState<SubscriptionTier | null>(null);

  useEffect(() => {
    if (!orgId) return;
    (async () => {
      try {
        const t = (await getTier({ data: { orgId } })) as { tier: SubscriptionTier };
        setLocalTier(t.tier);
        const members = (await membersFn({ data: { orgId } })) as any[];
        // crude owner check via member list — server enforces real auth
        setIsOwner(members.some((m) => m.org_role === "owner"));
      } catch { /* ignore */ }
    })();
  }, [orgId, getTier, membersFn]);

  const onSelect = async (id: SubscriptionTier) => {
    if (!orgId) return;
    setSaving(id);
    try {
      await setTier({ data: { orgId, tier: id } });
      setLocalTier(id);
      toast.success(`Switched to ${TIER_LABEL[id]}`);
    } catch (e: any) {
      toast.error(e.message ?? "Failed to change tier");
    } finally {
      setSaving(null);
    }
  };

  if (!orgId) {
    return <div className="p-8 text-muted-foreground text-sm">Select an organization to manage its plan.</div>;
  }

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-display text-2xl font-bold">Plans &amp; billing</h1>
        <p className="text-sm text-muted-foreground">
          Current plan: <span className="font-semibold text-foreground">{tier ? TIER_LABEL[tier] : "—"}</span>
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-3">
        {TIERS.map((t) => {
          const Icon = t.icon;
          const isCurrent = tier === t.id;
          return (
            <div key={t.id} className={`glass-panel rounded-xl p-6 flex flex-col ${isCurrent ? "ring-2 ring-primary" : ""}`}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Icon className="size-5 text-primary" />
                  <h2 className="font-display text-lg font-bold">{TIER_LABEL[t.id]}</h2>
                </div>
                {isCurrent && <Badge>Current</Badge>}
              </div>
              <p className="text-sm text-muted-foreground mb-4">{t.tagline}</p>
              <ul className="space-y-2 text-sm flex-1">
                {TIER_MATRIX.map((row) => {
                  const included = row[t.id];
                  return (
                    <li key={row.feature} className="flex items-start gap-2">
                      {included ? (
                        <Check className="size-4 text-primary shrink-0 mt-0.5" />
                      ) : (
                        <X className="size-4 text-muted-foreground/50 shrink-0 mt-0.5" />
                      )}
                      <span className={included ? "" : "text-muted-foreground/60"}>{row.feature}</span>
                    </li>
                  );
                })}
              </ul>
              <Button
                className="mt-6"
                variant={isCurrent ? "secondary" : "default"}
                disabled={isCurrent || !isOwner || saving !== null}
                onClick={() => onSelect(t.id)}
              >
                {isCurrent ? "Current plan" : saving === t.id ? "Switching…" : `Switch to ${TIER_LABEL[t.id]}`}
              </Button>
            </div>
          );
        })}
      </div>

      {!isOwner && (
        <p className="text-xs text-muted-foreground text-center">
          Only the organization owner can change the subscription tier.
        </p>
      )}
    </div>
  );
}
