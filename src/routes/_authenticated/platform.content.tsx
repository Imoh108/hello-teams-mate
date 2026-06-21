import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Library, Plus, Trash2, ExternalLink, ShieldCheck, Sparkles } from "lucide-react";
import {
  listContentSources,
  createContentSource,
  toggleSourceVerified,
  deleteContentSource,
} from "@/lib/platform-content.functions";
import { generateFromSource } from "@/lib/ai-pipeline.functions";

export const Route = createFileRoute("/_authenticated/platform/content")({
  component: ContentPage,
});

type Sources = Awaited<ReturnType<typeof listContentSources>>;

function ContentPage() {
  const [sources, setSources] = useState<Sources>([]);
  const [err, setErr] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "", url: "", topic: "", license: "", notes: "", verified: false,
  });
  const [busy, setBusy] = useState(false);

  async function refresh() {
    try { setSources(await listContentSources()); }
    catch (e: any) { setErr(e?.message ?? "Failed to load"); }
  }
  useEffect(() => { refresh(); }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await createContentSource({ data: { ...form, topic: form.topic || undefined, license: form.license || undefined, notes: form.notes || undefined } });
      toast.success("Source added");
      setForm({ name: "", url: "", topic: "", license: "", notes: "", verified: false });
      refresh();
    } catch (e: any) { toast.error(e?.message ?? "Failed"); }
    finally { setBusy(false); }
  }

  async function toggle(id: string, verified: boolean) {
    try { await toggleSourceVerified({ data: { id, verified } }); refresh(); }
    catch (e: any) { toast.error(e?.message ?? "Failed"); }
  }

  async function remove(id: string) {
    if (!confirm("Delete this source?")) return;
    try { await deleteContentSource({ data: { id } }); refresh(); toast.success("Deleted"); }
    catch (e: any) { toast.error(e?.message ?? "Failed"); }
  }

  if (err) return <div className="text-destructive">{err}</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold">Content sources</h1>
        <p className="text-sm text-muted-foreground">
          Curated free online references the AI pipeline can use when generating questions.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Plus className="size-4" /> Add source
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field label="Name *">
              <Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Wikipedia — Machine Learning" />
            </Field>
            <Field label="URL *">
              <Input required type="url" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} placeholder="https://…" />
            </Field>
            <Field label="Topic">
              <Input value={form.topic} onChange={(e) => setForm({ ...form, topic: e.target.value })} placeholder="ML basics" />
            </Field>
            <Field label="License">
              <Input value={form.license} onChange={(e) => setForm({ ...form, license: e.target.value })} placeholder="CC BY-SA 4.0" />
            </Field>
            <div className="md:col-span-2">
              <Field label="Notes">
                <Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
              </Field>
            </div>
            <div className="md:col-span-2 flex items-center justify-between">
              <label className="flex items-center gap-2 text-sm">
                <Switch checked={form.verified} onCheckedChange={(v) => setForm({ ...form, verified: v })} />
                Mark as verified
              </label>
              <Button type="submit" disabled={busy}>{busy ? "Adding…" : "Add source"}</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Library className="size-4" /> Library ({sources.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {sources.length === 0 ? (
            <p className="text-sm text-muted-foreground">No sources yet.</p>
          ) : (
            <ul className="divide-y divide-border">
              {sources.map((s: any) => (
                <li key={s.id} className="py-3 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm truncate">{s.name}</span>
                      {s.verified && (
                        <Badge variant="secondary" className="gap-1">
                          <ShieldCheck className="size-3" /> verified
                        </Badge>
                      )}
                      {s.topic && <Badge variant="outline">{s.topic}</Badge>}
                    </div>
                    <a href={s.url} target="_blank" rel="noreferrer"
                       className="text-xs text-muted-foreground hover:underline inline-flex items-center gap-1 mt-0.5">
                      <ExternalLink className="size-3" /> {s.url}
                    </a>
                    {s.license && <div className="text-xs text-muted-foreground mt-0.5">License: {s.license}</div>}
                    {s.notes && <div className="text-xs text-muted-foreground mt-1">{s.notes}</div>}
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <label className="flex items-center gap-1 text-xs">
                      <Switch checked={s.verified} onCheckedChange={(v) => toggle(s.id, v)} />
                    </label>
                    <Button size="sm" variant="ghost" onClick={() => remove(s.id)}>
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
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
