import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { listChallenges, saveChallenge, deleteChallenge, listBadges } from "@/lib/gamification.functions";
import { useCurrentOrgId } from "@/hooks/use-current-org";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Trash2, Flame, Pencil } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/challenges")({
  component: ChallengesAdminPage,
});

type Form = { id?: string; name: string; description: string; start_at: string; end_at: string; target_points: number; reward_badge_id: string | null };
const today = () => new Date().toISOString().slice(0, 10);
const inDays = (d: number) => new Date(Date.now() + d * 86400_000).toISOString().slice(0, 10);
const empty = (): Form => ({ name: "", description: "", start_at: today(), end_at: inDays(14), target_points: 500, reward_badge_id: null });

function ChallengesAdminPage() {
  const [orgId] = useCurrentOrgId();
  const listFn = useServerFn(listChallenges);
  const saveFn = useServerFn(saveChallenge);
  const delFn = useServerFn(deleteChallenge);
  const badgesFn = useServerFn(listBadges);
  const [items, setItems] = useState<any[]>([]);
  const [badges, setBadges] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Form>(empty());

  const refresh = async () => {
    if (!orgId) return;
    const [c, b] = await Promise.all([listFn({ data: { orgId } }), badgesFn({ data: { orgId } })]);
    setItems(c as any); setBadges(b as any);
  };
  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, [orgId]);

  const onSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgId) return;
    try {
      await saveFn({ data: {
        id: form.id, orgId, name: form.name, description: form.description || undefined,
        start_at: new Date(form.start_at).toISOString(),
        end_at: new Date(form.end_at + "T23:59:59").toISOString(),
        target_points: form.target_points,
        reward_badge_id: form.reward_badge_id || null,
      }});
      toast.success(form.id ? "Updated" : "Created"); setOpen(false); setForm(empty()); refresh();
    } catch (e: any) { toast.error(e.message); }
  };
  const onEdit = (c: any) => {
    setForm({
      id: c.id, name: c.name, description: c.description ?? "",
      start_at: c.start_at.slice(0, 10), end_at: c.end_at.slice(0, 10),
      target_points: c.target_points, reward_badge_id: c.reward_badge_id,
    });
    setOpen(true);
  };
  const onDelete = async (id: string) => { if (!confirm("Delete?")) return; await delFn({ data: { id } }); refresh(); };

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold flex items-center gap-2"><Flame className="size-6" /> Challenges</h1>
          <p className="text-sm text-muted-foreground">Time-bound point goals for employees.</p>
        </div>
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setForm(empty()); }}>
          <DialogTrigger asChild><Button><Plus className="size-4 mr-1" /> New challenge</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{form.id ? "Edit challenge" : "New challenge"}</DialogTitle></DialogHeader>
            <form onSubmit={onSave} className="space-y-3">
              <div><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required maxLength={120} /></div>
              <div><Label>Description</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} maxLength={500} rows={2} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Start</Label><Input type="date" value={form.start_at} onChange={(e) => setForm({ ...form, start_at: e.target.value })} /></div>
                <div><Label>End</Label><Input type="date" value={form.end_at} onChange={(e) => setForm({ ...form, end_at: e.target.value })} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Target points</Label><Input type="number" min={1} value={form.target_points} onChange={(e) => setForm({ ...form, target_points: Number(e.target.value) || 1 })} /></div>
                <div><Label>Reward badge</Label>
                  <Select value={form.reward_badge_id ?? "none"} onValueChange={(v) => setForm({ ...form, reward_badge_id: v === "none" ? null : v })}>
                    <SelectTrigger><SelectValue placeholder="— None —" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">— None —</SelectItem>
                      {badges.map((b) => <SelectItem key={b.id} value={b.id}>{b.icon} {b.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button type="submit" className="w-full">{form.id ? "Save" : "Create"}</Button>
            </form>
          </DialogContent>
        </Dialog>
      </header>

      {items.length === 0 ? (
        <div className="rounded-xl border border-border p-8 text-center text-sm text-muted-foreground">No challenges yet.</div>
      ) : (
        <div className="space-y-2">
          {items.map((c) => (
            <div key={c.id} className="glass-panel rounded-xl p-4 flex items-center justify-between gap-3">
              <div>
                <div className="font-display font-semibold">{c.name}</div>
                <div className="text-xs text-muted-foreground">
                  {new Date(c.start_at).toLocaleDateString()} – {new Date(c.end_at).toLocaleDateString()} · Target {c.target_points} pts
                </div>
              </div>
              <div className="flex gap-1">
                <Button size="icon" variant="ghost" onClick={() => onEdit(c)}><Pencil className="size-4" /></Button>
                <Button size="icon" variant="ghost" onClick={() => onDelete(c.id)}><Trash2 className="size-4" /></Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
