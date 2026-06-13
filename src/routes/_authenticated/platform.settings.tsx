import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { getPlatformSettings, updatePlatformSettings } from "@/lib/platform-team.functions";

export const Route = createFileRoute("/_authenticated/platform/settings")({
  component: SettingsPage,
});

type S = Awaited<ReturnType<typeof getPlatformSettings>>;

function SettingsPage() {
  const [s, setS] = useState<S | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    getPlatformSettings().then(setS).catch((e) => setErr(e?.message ?? "Failed"));
  }, []);

  async function save() {
    if (!s) return;
    setBusy(true);
    try {
      await updatePlatformSettings({ data: { quizDefaults: s.quizDefaults, notifications: s.notifications } });
      toast.success("Settings saved");
    } catch (e: any) { toast.error(e?.message ?? "Failed"); }
    finally { setBusy(false); }
  }

  if (err) return <div className="text-destructive">{err}</div>;
  if (!s) return <div className="text-muted-foreground">Loading…</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Platform-wide defaults applied to every quiz session and outbound email.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Quiz defaults</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Field label="Default timer (seconds)">
            <Input type="number" min={5} max={300} value={s.quizDefaults.timer_seconds}
              onChange={(e) => setS({ ...s, quizDefaults: { ...s.quizDefaults, timer_seconds: Number(e.target.value) } })} />
          </Field>
          <Field label="Max players per room">
            <Input type="number" min={1} max={500} value={s.quizDefaults.max_players}
              onChange={(e) => setS({ ...s, quizDefaults: { ...s.quizDefaults, max_players: Number(e.target.value) } })} />
          </Field>
          <Field label="Anti-cheat sensitivity">
            <Select value={s.quizDefaults.anticheat_sensitivity}
              onValueChange={(v) => setS({ ...s, quizDefaults: { ...s.quizDefaults, anticheat_sensitivity: v as any } })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Notification templates</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <Field label="Welcome email subject">
            <Input value={s.notifications.welcome_subject}
              onChange={(e) => setS({ ...s, notifications: { ...s.notifications, welcome_subject: e.target.value } })} />
          </Field>
          <Field label="Billing email subject">
            <Input value={s.notifications.billing_subject}
              onChange={(e) => setS({ ...s, notifications: { ...s.notifications, billing_subject: e.target.value } })} />
          </Field>
          <Field label="Churn-risk email subject">
            <Input value={s.notifications.churn_subject}
              onChange={(e) => setS({ ...s, notifications: { ...s.notifications, churn_subject: e.target.value } })} />
          </Field>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={save} disabled={busy}>{busy ? "Saving…" : "Save settings"}</Button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
