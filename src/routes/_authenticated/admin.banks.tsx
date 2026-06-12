import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { listBanks, createBank, deleteBank, createQuizFromBank } from "@/lib/cms.functions";
import { listDepartments } from "@/lib/orgs.functions";
import { useCurrentOrgId } from "@/hooks/use-current-org";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Library, Plus, Trash2, Sparkles, ChevronRight } from "lucide-react";
import type { Department, QuestionBank } from "@/lib/data/types";

export const Route = createFileRoute("/_authenticated/admin/banks")({
  component: BanksPage,
});

function BanksPage() {
  const [orgId] = useCurrentOrgId();
  const banksFn = useServerFn(listBanks);
  const deptsFn = useServerFn(listDepartments);
  const createFn = useServerFn(createBank);
  const deleteFn = useServerFn(deleteBank);
  const fromBankFn = useServerFn(createQuizFromBank);

  const [banks, setBanks] = useState<QuestionBank[]>([]);
  const [depts, setDepts] = useState<Department[]>([]);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [departmentId, setDepartmentId] = useState<string>("");

  const refresh = async () => {
    if (!orgId) return;
    const [b, d] = await Promise.all([
      banksFn({ data: { orgId } }),
      deptsFn({ data: { orgId } }),
    ]);
    setBanks(b as QuestionBank[]);
    setDepts(d as Department[]);
  };
  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, [orgId]);

  const onCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgId) return;
    try {
      await createFn({ data: {
        orgId, name: name.trim(),
        description: description.trim() || undefined,
        departmentId: departmentId || null,
      }});
      setName(""); setDescription(""); setDepartmentId(""); setOpen(false);
      toast.success("Bank created");
      refresh();
    } catch (e: any) { toast.error(e.message); }
  };

  const onDelete = async (id: string) => {
    if (!confirm("Delete this bank and all its questions?")) return;
    try { await deleteFn({ data: { bankId: id } }); toast.success("Deleted"); refresh(); }
    catch (e: any) { toast.error(e.message); }
  };

  const onCreateQuiz = async (bankId: string) => {
    try {
      const quiz = await fromBankFn({ data: { bankId, limit: 20, time_limit_s: 20 } }) as any;
      toast.success("Quiz created from bank");
      window.location.href = `/quizzes/${quiz.id}`;
    } catch (e: any) { toast.error(e.message); }
  };

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold flex items-center gap-2">
            <Library className="size-6" /> Question banks
          </h1>
          <p className="text-sm text-muted-foreground">Reusable libraries of proprietary training questions.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="size-4 mr-1" /> New bank</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Create question bank</DialogTitle></DialogHeader>
            <form onSubmit={onCreate} className="space-y-3">
              <div>
                <Label>Name</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} required maxLength={120} />
              </div>
              <div>
                <Label>Description</Label>
                <Textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={500} rows={3} />
              </div>
              <div>
                <Label>Department</Label>
                <Select value={departmentId || "none"} onValueChange={(v) => setDepartmentId(v === "none" ? "" : v)}>
                  <SelectTrigger><SelectValue placeholder="— None —" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— None —</SelectItem>
                    {depts.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" className="w-full">Create</Button>
            </form>
          </DialogContent>
        </Dialog>
      </header>

      {banks.length === 0 ? (
        <div className="rounded-xl border border-border p-8 text-center text-sm text-muted-foreground">
          No banks yet. Create your first one to start tagging questions by department or topic.
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {banks.map((b) => (
            <div key={b.id} className="glass-panel rounded-xl p-4 space-y-3">
              <div>
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-display font-semibold">{b.name}</h3>
                  <Button variant="ghost" size="icon" onClick={() => onDelete(b.id)}>
                    <Trash2 className="size-4" />
                  </Button>
                </div>
                {b.description && <p className="text-sm text-muted-foreground line-clamp-2">{b.description}</p>}
              </div>
              <div className="flex items-center gap-2">
                <Button asChild variant="outline" size="sm">
                  <Link to="/admin/banks/$bankId" params={{ bankId: b.id }}>
                    Manage <ChevronRight className="size-3 ml-1" />
                  </Link>
                </Button>
                <Button size="sm" onClick={() => onCreateQuiz(b.id)}>
                  <Sparkles className="size-3 mr-1" /> Create quiz
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
