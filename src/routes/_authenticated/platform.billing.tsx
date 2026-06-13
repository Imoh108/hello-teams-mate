import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { DollarSign, Building2, Users, TrendingUp } from "lucide-react";
import {
  getBillingOverview,
  listOrganizations,
  updateOrgTier,
} from "@/lib/platform-billing.functions";

export const Route = createFileRoute("/_authenticated/platform/billing")({
  component: BillingPage,
});

type Overview = Awaited<ReturnType<typeof getBillingOverview>>;
type Orgs = Awaited<ReturnType<typeof listOrganizations>>;

function fmt(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

function BillingPage() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [orgs, setOrgs] = useState<Orgs>([]);
  const [err, setErr] = useState<string | null>(null);

  async function refresh() {
    try {
      const [o, l] = await Promise.all([getBillingOverview(), listOrganizations()]);
      setOverview(o);
      setOrgs(l as Orgs);
    } catch (e: any) { setErr(e?.message ?? "Failed to load"); }
  }
  useEffect(() => { refresh(); }, []);

  async function setTier(orgId: string, tier: "basic" | "premium" | "enterprise") {
    try {
      await updateOrgTier({ data: { orgId, tier } });
      toast.success("Tier updated");
      refresh();
    } catch (e: any) { toast.error(e?.message ?? "Update failed"); }
  }

  if (err) return <div className="text-destructive">{err}</div>;
  if (!overview) return <div className="text-muted-foreground">Loading…</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold">Billing & organizations</h1>
        <p className="text-sm text-muted-foreground">
          Estimated MRR/ARR based on tier pricing. Adjust an org's tier inline.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat icon={DollarSign} label="MRR (est.)" value={fmt(overview.mrr)} />
        <Stat icon={TrendingUp} label="ARR (est.)" value={fmt(overview.arr)} />
        <Stat icon={Building2} label="Organizations" value={overview.orgCount} sub={`B${overview.tierCounts.basic} · P${overview.tierCounts.premium} · E${overview.tierCounts.enterprise}`} />
        <Stat icon={Users} label="Total seats" value={overview.totalSeats} />
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Organizations</CardTitle>
        </CardHeader>
        <CardContent>
          {orgs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No organizations.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted-foreground border-b border-border">
                    <th className="py-2 pr-3">Name</th>
                    <th className="py-2 pr-3">Tier</th>
                    <th className="py-2 pr-3">Seats</th>
                    <th className="py-2 pr-3">Monthly</th>
                    <th className="py-2 pr-3">Backend</th>
                    <th className="py-2 pr-3">Created</th>
                    <th className="py-2 pr-3">Change tier</th>
                  </tr>
                </thead>
                <tbody>
                  {orgs.map((o) => (
                    <tr key={o.id} className="border-b border-border">
                      <td className="py-2 pr-3">
                        <div className="font-medium">{o.name}</div>
                        <div className="text-xs text-muted-foreground">{o.slug}</div>
                      </td>
                      <td className="py-2 pr-3">
                        <Badge variant={o.subscription_tier === "enterprise" ? "default" : "secondary"}>
                          {o.subscription_tier}
                        </Badge>
                      </td>
                      <td className="py-2 pr-3">{o.seats}</td>
                      <td className="py-2 pr-3">{fmt(o.monthly)}</td>
                      <td className="py-2 pr-3 text-xs">{o.data_backend}</td>
                      <td className="py-2 pr-3 text-xs text-muted-foreground">
                        {new Date(o.created_at).toLocaleDateString()}
                      </td>
                      <td className="py-2 pr-3">
                        <Select value={o.subscription_tier as string} onValueChange={(v) => setTier(o.id, v as any)}>
                          <SelectTrigger className="h-8 w-32"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="basic">Basic</SelectItem>
                            <SelectItem value="premium">Premium</SelectItem>
                            <SelectItem value="enterprise">Enterprise</SelectItem>
                          </SelectContent>
                        </Select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        Pricing is a flat estimate (Basic $0, Premium $49, Enterprise $299 / org / mo).
        Wire real subscription data by enabling Lovable Payments later.
      </p>
    </div>
  );
}

function Stat({ icon: Icon, label, value, sub }: { icon: any; label: string; value: number | string; sub?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Icon className="size-3.5" /> {label}
        </div>
        <div className="mt-1 text-2xl font-display font-semibold">{value}</div>
        {sub && <div className="text-xs text-muted-foreground mt-1">{sub}</div>}
      </CardContent>
    </Card>
  );
}
