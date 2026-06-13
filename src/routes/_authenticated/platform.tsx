import { createFileRoute, Link, Outlet, useRouterState, redirect } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LayoutDashboard, Shield, ArrowLeft, Activity } from "lucide-react";
import { isPlatformAdmin } from "@/lib/platform.functions";

export const Route = createFileRoute("/_authenticated/platform")({
  head: () => ({ meta: [{ title: "Platform Admin — QuizPulse" }] }),
  beforeLoad: async () => {
    try {
      const { isAdmin } = await isPlatformAdmin();
      if (!isAdmin) throw redirect({ to: "/app" });
    } catch (e: any) {
      if (e?.isRedirect) throw e;
      throw redirect({ to: "/app" });
    }
  },
  component: PlatformLayout,
});

function PlatformLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const nav = [
    { to: "/platform", label: "Overview", icon: LayoutDashboard },
  ];

  return (
    <div className="min-h-screen">
      <header className="border-b border-border">
        <div className="container mx-auto flex items-center justify-between px-6 py-4">
          <Link to="/app" className="flex items-center gap-2">
            <Shield className="size-5 text-primary" />
            <span className="font-display font-semibold">QuizPulse Platform</span>
            <Badge variant="secondary" className="ml-2">super-admin</Badge>
          </Link>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/app"><ArrowLeft className="size-4 mr-1" /> Exit</Link>
          </Button>
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
          <p className="mt-6 text-xs text-muted-foreground px-3">
            More modules (system health, billing, AI pipeline, content) ship in
            later phases.
          </p>
        </aside>
        <main className="col-span-12 md:col-span-9 lg:col-span-10">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
