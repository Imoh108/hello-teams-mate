import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useServerFn } from "@tanstack/react-start";
import { listMyOrganizations, getOrgTier } from "@/lib/orgs.functions";
import { useCurrentOrgId } from "@/hooks/use-current-org";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LanguageSwitcher } from "@/components/language-switcher";
import {
  Building2, Users, FolderTree, LayoutDashboard, Library, FileText, ShoppingBag,
  Trophy, Flame, BarChart3, Lock, CreditCard,
} from "lucide-react";
import type { Organization } from "@/lib/data/types";
import { hasTier, TIER_LABEL, type SubscriptionTier } from "@/lib/tiers";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "Admin — QuizPulse" }] }),
  component: AdminLayout,
});

function AdminLayout() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const listFn = useServerFn(listMyOrganizations);
  const tierFn = useServerFn(getOrgTier);
  const [orgId, setOrgId] = useCurrentOrgId();
  const [orgs, setOrgs] = useState<Organization[] | null>(null);
  const [tier, setTier] = useState<SubscriptionTier | null>(null);
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    (async () => {
      try {
        const rows = (await listFn({})) as Organization[];
        setOrgs(rows);
        if (rows.length === 0) {
          navigate({ to: "/onboarding" });
          return;
        }
        if (!orgId || !rows.find((o) => o.id === orgId)) {
          setOrgId(rows[0].id);
        }
      } catch {
        setOrgs([]);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!orgId) { setTier(null); return; }
    (async () => {
      try {
        const r = (await tierFn({ data: { orgId } })) as { tier: SubscriptionTier };
        setTier(r.tier);
      } catch { setTier("basic"); }
    })();
  }, [orgId, tierFn]);

  const current = orgs?.find((o) => o.id === orgId) ?? null;

  const nav: { to: string; label: string; icon: any; min: SubscriptionTier }[] = [
    { to: "/admin", label: t("admin.overview"), icon: LayoutDashboard, min: "basic" },
    { to: "/admin/members", label: t("admin.members"), icon: Users, min: "basic" },
    { to: "/admin/departments", label: t("admin.departments"), icon: FolderTree, min: "basic" },
    { to: "/admin/analytics", label: t("admin.analytics"), icon: BarChart3, min: "premium" },
    { to: "/admin/banks", label: t("admin.questionBanks"), icon: Library, min: "premium" },
    { to: "/admin/documents", label: t("admin.trainingDocs"), icon: FileText, min: "premium" },
    { to: "/admin/items", label: t("admin.shopItems"), icon: ShoppingBag, min: "enterprise" },
    { to: "/admin/badges", label: t("admin.badges"), icon: Trophy, min: "enterprise" },
    { to: "/admin/challenges", label: t("admin.challenges"), icon: Flame, min: "enterprise" },
  ];

  if (orgs === null) {
    return <div className="min-h-screen grid place-items-center text-muted-foreground">{t("common.loading")}</div>;
  }

  const showLangSwitcher = hasTier(tier, "enterprise");

  return (
    <div className="min-h-screen">
      <header className="border-b border-border">
        <div className="container mx-auto flex items-center justify-between px-6 py-4">
          <Link to="/app" className="flex items-center gap-2">
            <div className="size-7 rounded-md bg-primary grid place-items-center text-primary-foreground font-display font-bold text-sm">Q</div>
            <span className="font-display font-semibold">QuizPulse Admin</span>
          </Link>
          <div className="flex items-center gap-3">
            {tier && <Badge variant="secondary" className="hidden md:inline-flex">{TIER_LABEL[tier]}</Badge>}
            {orgs.length > 0 && (
              <Select value={orgId ?? undefined} onValueChange={(v) => setOrgId(v)}>
                <SelectTrigger className="w-56">
                  <Building2 className="size-4 mr-2" />
                  <SelectValue placeholder="Select organization" />
                </SelectTrigger>
                <SelectContent>
                  {orgs.map((o) => (
                    <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {showLangSwitcher && <LanguageSwitcher compact />}
            <Button variant="ghost" size="sm" asChild><Link to="/app">{t("admin.exit")}</Link></Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto grid grid-cols-12 gap-6 px-6 py-8">
        <aside className="col-span-12 md:col-span-3 lg:col-span-2">
          <nav className="space-y-1">
            {nav.map((n) => {
              const unlocked = hasTier(tier, n.min);
              const active = pathname === n.to;
              const target = unlocked ? n.to : "/admin/upgrade";
              return (
                <Link
                  key={n.to}
                  to={target}
                  className={`flex items-center justify-between gap-2 rounded-md px-3 py-2 text-sm transition ${
                    active ? "bg-surface-2 text-foreground" : "text-muted-foreground hover:bg-surface"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <n.icon className="size-4" />
                    {n.label}
                  </span>
                  {!unlocked && (
                    <span className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground/80">
                      <Lock className="size-3" />
                      {TIER_LABEL[n.min]}
                    </span>
                  )}
                </Link>
              );
            })}
            <Link
              to="/admin/upgrade"
              className={`mt-3 flex items-center gap-2 rounded-md px-3 py-2 text-sm transition border border-border ${
                pathname === "/admin/upgrade" ? "bg-surface-2 text-foreground" : "text-muted-foreground hover:bg-surface"
              }`}
            >
              <CreditCard className="size-4" />
              Plans &amp; billing
            </Link>
          </nav>
          {current && (
            <div className="mt-6 rounded-lg border border-border p-3 text-xs text-muted-foreground">
              <div className="font-semibold text-foreground">{current.name}</div>
              <div className="font-mono-tab mt-1">{current.slug}</div>
              <div className="mt-2">Plan: {tier ? TIER_LABEL[tier] : "—"}</div>
              <div>Backend: {current.data_backend}</div>
            </div>
          )}
        </aside>
        <main className="col-span-12 md:col-span-9 lg:col-span-10">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
