import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { listMyOrganizations } from "@/lib/orgs.functions";
import { useCurrentOrgId } from "@/hooks/use-current-org";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Building2, Users, FolderTree, LayoutDashboard, Library, FileText } from "lucide-react";
import type { Organization } from "@/lib/data/types";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "Admin — QuizPulse" }] }),
  component: AdminLayout,
});

function AdminLayout() {
  const navigate = useNavigate();
  const listFn = useServerFn(listMyOrganizations);
  const [orgId, setOrgId] = useCurrentOrgId();
  const [orgs, setOrgs] = useState<Organization[] | null>(null);
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

  const current = orgs?.find((o) => o.id === orgId) ?? null;

  const nav = [
    { to: "/admin", label: "Overview", icon: LayoutDashboard },
    { to: "/admin/members", label: "Members", icon: Users },
    { to: "/admin/departments", label: "Departments", icon: FolderTree },
  ];

  if (orgs === null) {
    return <div className="min-h-screen grid place-items-center text-muted-foreground">Loading…</div>;
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-border">
        <div className="container mx-auto flex items-center justify-between px-6 py-4">
          <Link to="/app" className="flex items-center gap-2">
            <div className="size-7 rounded-md bg-primary grid place-items-center text-primary-foreground font-display font-bold text-sm">Q</div>
            <span className="font-display font-semibold">QuizPulse Admin</span>
          </Link>
          <div className="flex items-center gap-3">
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
            <Button variant="ghost" size="sm" asChild><Link to="/app">Exit admin</Link></Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto grid grid-cols-12 gap-6 px-6 py-8">
        <aside className="col-span-12 md:col-span-3 lg:col-span-2">
          <nav className="space-y-1">
            {nav.map((n) => {
              const active = pathname === n.to;
              return (
                <Link
                  key={n.to}
                  to={n.to}
                  className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm transition ${
                    active ? "bg-surface-2 text-foreground" : "text-muted-foreground hover:bg-surface"
                  }`}
                >
                  <n.icon className="size-4" />
                  {n.label}
                </Link>
              );
            })}
          </nav>
          {current && (
            <div className="mt-6 rounded-lg border border-border p-3 text-xs text-muted-foreground">
              <div className="font-semibold text-foreground">{current.name}</div>
              <div className="font-mono-tab mt-1">{current.slug}</div>
              <div className="mt-2">Backend: {current.data_backend}</div>
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
