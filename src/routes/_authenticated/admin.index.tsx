import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { listMembers, listDepartments, listInvites } from "@/lib/orgs.functions";
import { useCurrentOrgId } from "@/hooks/use-current-org";
import { Users, FolderTree, Mail } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/")({
  component: AdminIndex,
});

function AdminIndex() {
  const [orgId] = useCurrentOrgId();
  const membersFn = useServerFn(listMembers);
  const deptsFn = useServerFn(listDepartments);
  const invitesFn = useServerFn(listInvites);
  const [counts, setCounts] = useState({ members: 0, departments: 0, invites: 0 });

  useEffect(() => {
    if (!orgId) return;
    (async () => {
      try {
        const [m, d, i] = await Promise.all([
          membersFn({ data: { orgId } }),
          deptsFn({ data: { orgId } }),
          invitesFn({ data: { orgId } }),
        ]);
        setCounts({
          members: (m as any[]).length,
          departments: (d as any[]).length,
          invites: (i as any[]).length,
        });
      } catch {
        // ignored
      }
    })();
  }, [orgId, membersFn, deptsFn, invitesFn]);

  const tiles = [
    { to: "/admin/members", label: "Members", value: counts.members, icon: Users },
    { to: "/admin/departments", label: "Departments", value: counts.departments, icon: FolderTree },
    { to: "/admin/members", label: "Pending invites", value: counts.invites, icon: Mail },
  ];

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-bold">Overview</h1>
        <p className="text-sm text-muted-foreground">Manage your organization, departments, and members.</p>
      </header>
      <div className="grid gap-3 sm:grid-cols-3">
        {tiles.map((t) => (
          <Link key={t.label} to={t.to} className="glass-panel rounded-xl p-5 hover:bg-surface transition">
            <t.icon className="size-5 text-muted-foreground" />
            <div className="mt-2 font-display text-3xl font-bold">{t.value}</div>
            <div className="text-sm text-muted-foreground">{t.label}</div>
          </Link>
        ))}
      </div>
      <div className="rounded-xl border border-border p-5">
        <h2 className="font-display text-lg font-semibold">Coming next</h2>
        <ul className="mt-2 space-y-1 text-sm text-muted-foreground list-disc pl-5">
          <li>Question banks &amp; document uploads (CMS)</li>
          <li>AI-generated questions from your uploaded training docs</li>
          <li>Gamification: avatars, challenges, badges</li>
          <li>Analytics: participation &amp; knowledge gaps</li>
        </ul>
      </div>
    </div>
  );
}
