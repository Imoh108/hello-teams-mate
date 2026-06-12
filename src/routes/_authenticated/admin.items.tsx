import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { listShop, saveItem, deleteItem } from "@/lib/gamification.functions";
import { useCurrentOrgId } from "@/hooks/use-current-org";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Trash2, ShoppingBag, Pencil } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/items")({
  component: ItemsAdminPage,
});

type Form = { id?: string; name: string; category: string; image_url: string; cost_points: number; rarity: "common"|"rare"|"epic"|"legendary" };
const empty = (): Form => ({ name: "", category: "avatar", image_url: "", cost_points: 100, rarity: "common" });

function ItemsAdminPage() {
  const [orgId] = useCurrentOrgId();
  const listFn = useServerFn(listShop);
  const saveFn = useServerFn(saveItem);
  const delFn = useServerFn(deleteItem);
  const [items, setItems] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Form>(empty());

  const refresh = async () => setItems(orgId ? await listFn({ data: { orgId } }) as any : []);
  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, [orgId]);

  const onSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgId) return;
    try {
      await saveFn({ data: { ...form, orgId } });
      toast.success(form.id ? "Updated" : "Created"); setOpen(false); setForm(empty()); refresh();
    } catch (e: any) { toast.error(e.message); }
  };
  const onEdit = (i: any) => { setForm({ id: i.id, name: i.name, category: i.category, image_url: i.image_url, cost_points: i.cost_points, rarity: i.rarity }); setOpen(true); };
  const onDelete = async (id: string) => { if (!confirm("Delete?")) return; await delFn({ data: { id } }); refresh(); };

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold flex items-center gap-2"><ShoppingBag className="size-6" /> Shop items</h1>
          <p className="text-sm text-muted-foreground">Avatars and cosmetics employees can buy with points.</p>
        </div>
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setForm(empty()); }}>
          <DialogTrigger asChild><Button><Plus className="size-4 mr-1" /> New item</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{form.id ? "Edit item" : "New item"}</DialogTitle></DialogHeader>
            <form onSubmit={onSave} className="space-y-3">
              <div><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required maxLength={80} /></div>
              <div><Label>Image URL</Label><Input value={form.image_url} onChange={(e) => setForm({ ...form, image_url: e.target.value })} required maxLength={500} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Cost (pts)</Label><Input type="number" min={0} value={form.cost_points} onChange={(e) => setForm({ ...form, cost_points: Number(e.target.value) || 0 })} /></div>
                <div><Label>Rarity</Label>
                  <Select value={form.rarity} onValueChange={(v) => setForm({ ...form, rarity: v as Form["rarity"] })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="common">Common</SelectItem>
                      <SelectItem value="rare">Rare</SelectItem>
                      <SelectItem value="epic">Epic</SelectItem>
                      <SelectItem value="legendary">Legendary</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div><Label>Category</Label><Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} maxLength={40} /></div>
              <Button type="submit" className="w-full">{form.id ? "Save" : "Create"}</Button>
            </form>
          </DialogContent>
        </Dialog>
      </header>

      {items.length === 0 ? (
        <div className="rounded-xl border border-border p-8 text-center text-sm text-muted-foreground">No items yet.</div>
      ) : (
        <div className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {items.filter((i) => i.org_id === orgId).map((i) => (
            <div key={i.id} className="glass-panel rounded-xl p-3 text-center">
              <img src={i.image_url} alt={i.name} className="size-20 mx-auto rounded-full object-cover" />
              <div className="font-medium text-sm mt-2">{i.name}</div>
              <div className="text-xs text-muted-foreground">{i.cost_points} pts · {i.rarity}</div>
              <div className="flex gap-1 mt-2 justify-center">
                <Button size="icon" variant="ghost" onClick={() => onEdit(i)}><Pencil className="size-4" /></Button>
                <Button size="icon" variant="ghost" onClick={() => onDelete(i.id)}><Trash2 className="size-4" /></Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
