import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { listBadges, saveBadge, deleteBadge } from "@/lib/gamification.functions";
import { useCurrentOrgId } from "@/hooks/use-current-org";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Trash2, Trophy, Pencil } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/badges")({
  component: BadgesAdminPage,
});

type Form = { id?: string; name: string; description: string; icon: string; criteria_type: "manual"|"points_total"|"quizzes_completed"; criteria_value: number | null };
const empty = (): Form => ({ name: "", description: "", icon: "🏅", criteria_type: "manual", criteria_value: null });

function BadgesAdminPage() {
  const [orgId] = useCurrentOrgId();
  const listFn = useServerFn(listBadges);
  const saveFn = useServerFn(saveBadge);
  const delFn = useServerFn(deleteBadge);
  const [items, setItems] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Form>(empty());

  const refresh = async () => setItems(orgId ? await listFn({ data: { orgId } }) as any : []);
  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, [orgId]);

  const onSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgId) return;
    try {
      await saveFn({ data: {
        id: form.id, orgId, name: form.name, description: form.description || undefined,
        icon: form.icon, criteria_type: form.criteria_type,
        criteria_value: form.criteria_type === "manual" ? null : form.criteria_value,
      }});
      toast.success(form.id ? "Updated" : "Created"); setOpen(false); setForm(empty()); refresh();
    } catch (e: any) { toast.error(e.message); }
  };
  const onEdit = (b: any) => setForm({ id: b.id, name: b.name, description: b.description ?? "", icon: b.icon, criteria_type: b.criteria_type, criteria_value: b.criteria_value }) || setOpen(true);
  const onDelete = async (id: string) => { if (!confirm("Delete?")) return; await delFn({ data: { id } }); refresh(); };

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold flex items-center gap-2"><Trophy className="size-6" /> Badges</h1>
          <p className="text-sm text-muted-foreground">Achievements awarded to employees.</p>
        </div>
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setForm(empty()); }}>
          <DialogTrigger asChild><Button><Plus className="size-4 mr-1" /> New badge</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{form.id ? "Edit badge" : "New badge"}</DialogTitle></DialogHeader>
            <form onSubmit={onSave} className="space-y-3">
              <div className="grid grid-cols-[80px_1fr] gap-3">
                <div><Label>Icon</Label><Input value={form.icon} onChange={(e) => setForm({ ...form, icon: e.target.value })} maxLength={8} className="text-center text-xl" /></div>
                <div><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required maxLength={80} /></div>
              </div>
              <div><Label>Description</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} maxLength={500} rows={2} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Criteria</Label>
                  <Select value={form.criteria_type} onValueChange={(v) => setForm({ ...form, criteria_type: v as Form["criteria_type"] })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="manual">Manual</SelectItem>
                      <SelectItem value="points_total">Total points</SelectItem>
                      <SelectItem value="quizzes_completed">Quizzes completed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {form.criteria_type !== "manual" && (
                  <div><Label>Threshold</Label>
                    <Input type="number" min={0} value={form.criteria_value ?? 0}
                      onChange={(e) => setForm({ ...form, criteria_value: Number(e.target.value) || 0 })} />
                  </div>
                )}
              </div>
              <Button type="submit" className="w-full">{form.id ? "Save" : "Create"}</Button>
            </form>
          </DialogContent>
        </Dialog>
      </header>

      {items.length === 0 ? (
        <div className="rounded-xl border border-border p-8 text-center text-sm text-muted-foreground">No badges yet.</div>
      ) : (
        <div className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {items.map((b) => (
            <div key={b.id} className="glass-panel rounded-xl p-3 text-center">
              <div className="text-4xl">{b.icon}</div>
              <div className="font-medium text-sm mt-1">{b.name}</div>
              <div className="text-xs text-muted-foreground">{b.criteria_type}{b.criteria_value ? ` ≥ ${b.criteria_value}` : ""}</div>
              {b.org_id === orgId && (
                <div className="flex gap-1 mt-2 justify-center">
                  <Button size="icon" variant="ghost" onClick={() => onEdit(b)}><Pencil className="size-4" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => onDelete(b.id)}><Trash2 className="size-4" /></Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
