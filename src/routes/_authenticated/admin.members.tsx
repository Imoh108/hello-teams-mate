import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  listMembers, listInvites, listDepartments,
  createInvite, updateMemberRole,
} from "@/lib/orgs.functions";
import { useCurrentOrgId } from "@/hooks/use-current-org";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Copy } from "lucide-react";
import type { OrgRole, OrganizationMember, OrganizationInvite, Department } from "@/lib/data/types";

export const Route = createFileRoute("/_authenticated/admin/members")({
  component: MembersPage,
});

const ROLES: OrgRole[] = ["owner", "admin", "hr", "team_lead", "member"];

function MembersPage() {
  const [orgId] = useCurrentOrgId();
  const membersFn = useServerFn(listMembers);
  const invitesFn = useServerFn(listInvites);
  const deptsFn = useServerFn(listDepartments);
  const inviteFn = useServerFn(createInvite);
  const updateRoleFn = useServerFn(updateMemberRole);

  const [members, setMembers] = useState<OrganizationMember[]>([]);
  const [invites, setInvites] = useState<OrganizationInvite[]>([]);
  const [depts, setDepts] = useState<Department[]>([]);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<OrgRole>("member");
  const [deptId, setDeptId] = useState<string>("");

  const refresh = async () => {
    if (!orgId) return;
    const [m, i, d] = await Promise.all([
      membersFn({ data: { orgId } }),
      invitesFn({ data: { orgId } }),
      deptsFn({ data: { orgId } }),
    ]);
    setMembers(m as OrganizationMember[]);
    setInvites(i as OrganizationInvite[]);
    setDepts(d as Department[]);
  };

  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, [orgId]);

  const onInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgId || !email.trim()) return;
    try {
      await inviteFn({ data: { orgId, email: email.trim(), role, departmentId: deptId || null } });
      setEmail("");
      toast.success("Invite created");
      refresh();
    } catch (e: any) { toast.error(e.message); }
  };

  const onRoleChange = async (memberId: string, newRole: OrgRole) => {
    try {
      await updateRoleFn({ data: { memberId, role: newRole } });
      toast.success("Role updated");
      refresh();
    } catch (e: any) { toast.error(e.message); }
  };

  const copyInviteLink = (token: string) => {
    const url = `${window.location.origin}/invite/${token}`;
    navigator.clipboard.writeText(url);
    toast.success("Invite link copied");
  };

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-display text-2xl font-bold">Members</h1>
        <p className="text-sm text-muted-foreground">Invite teammates and manage their roles.</p>
      </header>

      <section className="glass-panel rounded-xl p-5">
        <h2 className="font-display text-lg font-semibold mb-3">Invite by email</h2>
        <form onSubmit={onInvite} className="grid gap-3 md:grid-cols-[1fr_140px_180px_auto]">
          <div>
            <Label className="text-xs">Email</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div>
            <Label className="text-xs">Role</Label>
            <Select value={role} onValueChange={(v) => setRole(v as OrgRole)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {ROLES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Department</Label>
            <Select value={deptId || "none"} onValueChange={(v) => setDeptId(v === "none" ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— None —</SelectItem>
                {depts.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end"><Button type="submit">Create invite</Button></div>
        </form>
      </section>

      {invites.length > 0 && (
        <section>
          <h2 className="font-display text-lg font-semibold mb-3">Pending invites</h2>
          <div className="rounded-xl border border-border divide-y divide-border">
            {invites.map((inv) => (
              <div key={inv.id} className="flex items-center justify-between p-3">
                <div>
                  <div className="font-medium">{inv.email}</div>
                  <div className="text-xs text-muted-foreground">
                    {inv.org_role} · expires {new Date(inv.expires_at).toLocaleDateString()}
                  </div>
                </div>
                <Button size="sm" variant="outline" onClick={() => copyInviteLink(inv.token)}>
                  <Copy className="size-3 mr-1" /> Copy link
                </Button>
              </div>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="font-display text-lg font-semibold mb-3">Current members</h2>
        <div className="rounded-xl border border-border divide-y divide-border">
          {members.map((m) => (
            <div key={m.id} className="flex items-center justify-between p-3">
              <div className="font-mono-tab text-xs text-muted-foreground">{m.user_id}</div>
              <Select value={m.org_role} onValueChange={(v) => onRoleChange(m.id, v as OrgRole)}>
                <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ROLES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          ))}
          {members.length === 0 && <div className="p-4 text-sm text-muted-foreground">No members yet.</div>}
        </div>
      </section>
    </div>
  );
}
