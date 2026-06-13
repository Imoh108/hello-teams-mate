import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Shield, UserPlus, Trash2 } from "lucide-react";
import {
  listPlatformAdmins,
  grantPlatformAdmin,
  revokePlatformAdmin,
} from "@/lib/platform-team.functions";

export const Route = createFileRoute("/_authenticated/platform/team")({
  component: TeamPage,
});

type Admins = Awaited<ReturnType<typeof listPlatformAdmins>>;

function TeamPage() {
  const [admins, setAdmins] = useState<Admins>([]);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function refresh() {
    try { setAdmins(await listPlatformAdmins()); }
    catch (e: any) { setErr(e?.message ?? "Failed to load"); }
  }
  useEffect(() => { refresh(); }, []);

  async function grant(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    setBusy(true);
    try {
      await grantPlatformAdmin({ data: { email } });
      toast.success("Platform admin granted");
      setEmail("");
      refresh();
    } catch (e: any) { toast.error(e?.message ?? "Failed"); }
    finally { setBusy(false); }
  }

  async function revoke(userId: string) {
    if (!confirm("Revoke platform-admin role from this user?")) return;
    try {
      await revokePlatformAdmin({ data: { userId } });
      toast.success("Revoked");
      refresh();
    } catch (e: any) { toast.error(e?.message ?? "Failed"); }
  }

  if (err) return <div className="text-destructive">{err}</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold">Team access</h1>
        <p className="text-sm text-muted-foreground">
          Manage who has platform super-admin access to this dashboard.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <UserPlus className="size-4" /> Grant platform admin
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={grant} className="flex gap-2">
            <Input
              type="email"
              placeholder="teammate@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <Button type="submit" disabled={busy}>{busy ? "Granting…" : "Grant"}</Button>
          </form>
          <p className="text-xs text-muted-foreground mt-2">
            The user must already have signed up. Look-up scans up to 1,000 users.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="size-4" /> Current platform admins ({admins.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {admins.length === 0 ? (
            <p className="text-sm text-muted-foreground">None yet.</p>
          ) : (
            <ul className="divide-y divide-border">
              {admins.map((a) => (
                <li key={a.userId} className="py-2 flex items-center justify-between">
                  <div>
                    <div className="font-medium text-sm">
                      {a.displayName ?? "—"}
                      {a.isSelf && <Badge variant="secondary" className="ml-2">you</Badge>}
                    </div>
                    <div className="text-xs text-muted-foreground">{a.email ?? a.userId}</div>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={a.isSelf}
                    onClick={() => revoke(a.userId)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
