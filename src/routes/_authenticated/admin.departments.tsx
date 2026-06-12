import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { listDepartments, createDepartment } from "@/lib/orgs.functions";
import { useCurrentOrgId } from "@/hooks/use-current-org";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import type { Department } from "@/lib/data/types";

export const Route = createFileRoute("/_authenticated/admin/departments")({
  component: DepartmentsPage,
});

function slugify(s: string) {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
}

function DepartmentsPage() {
  const [orgId] = useCurrentOrgId();
  const listFn = useServerFn(listDepartments);
  const createFn = useServerFn(createDepartment);
  const [depts, setDepts] = useState<Department[]>([]);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");

  const refresh = async () => {
    if (!orgId) return;
    const d = await listFn({ data: { orgId } });
    setDepts(d as Department[]);
  };
  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, [orgId]);

  const onCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgId || !name.trim()) return;
    try {
      await createFn({ data: { orgId, name: name.trim(), slug: slug || slugify(name) } });
      setName(""); setSlug("");
      toast.success("Department added");
      refresh();
    } catch (e: any) { toast.error(e.message); }
  };

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-display text-2xl font-bold">Departments</h1>
        <p className="text-sm text-muted-foreground">Group members by team for targeted training.</p>
      </header>

      <section className="glass-panel rounded-xl p-5">
        <form onSubmit={onCreate} className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
          <div>
            <Label className="text-xs">Name</Label>
            <Input value={name} onChange={(e) => { setName(e.target.value); if (!slug) setSlug(slugify(e.target.value)); }} maxLength={80} required />
          </div>
          <div>
            <Label className="text-xs">Slug</Label>
            <Input value={slug} onChange={(e) => setSlug(slugify(e.target.value))} placeholder="sales" maxLength={40} required />
          </div>
          <div className="flex items-end"><Button type="submit">Add department</Button></div>
        </form>
      </section>

      <div className="rounded-xl border border-border divide-y divide-border">
        {depts.map((d) => (
          <div key={d.id} className="flex items-center justify-between p-3">
            <div>
              <div className="font-medium">{d.name}</div>
              <div className="font-mono-tab text-xs text-muted-foreground">{d.slug}</div>
            </div>
          </div>
        ))}
        {depts.length === 0 && <div className="p-4 text-sm text-muted-foreground">No departments yet.</div>}
      </div>
    </div>
  );
}
