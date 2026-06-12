import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  getBank, saveBankQuestion, deleteBankQuestion,
  addBankTag, removeBankTag,
} from "@/lib/cms.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { ArrowLeft, Plus, Trash2, X, Tag as TagIcon, Check, Pencil } from "lucide-react";
import type { BankQuestion, BankTag, QuestionBank } from "@/lib/data/types";

export const Route = createFileRoute("/_authenticated/admin/banks/$bankId")({
  component: BankDetailPage,
});

type QForm = {
  id?: string;
  prompt: string;
  choices: [string, string, string, string];
  correct_index: number;
  explanation: string;
  difficulty: number;
};

const emptyForm = (): QForm => ({
  prompt: "", choices: ["", "", "", ""], correct_index: 0, explanation: "", difficulty: 1,
});

function BankDetailPage() {
  const { bankId } = Route.useParams();
  const getFn = useServerFn(getBank);
  const saveFn = useServerFn(saveBankQuestion);
  const delFn = useServerFn(deleteBankQuestion);
  const addTagFn = useServerFn(addBankTag);
  const rmTagFn = useServerFn(removeBankTag);

  const [bank, setBank] = useState<QuestionBank | null>(null);
  const [questions, setQuestions] = useState<BankQuestion[]>([]);
  const [tags, setTags] = useState<BankTag[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<QForm>(emptyForm());

  const refresh = async () => {
    const res = await getFn({ data: { bankId } }) as any;
    setBank(res.bank); setQuestions(res.questions); setTags(res.tags);
  };
  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, [bankId]);

  const openNew = () => { setForm(emptyForm()); setOpen(true); };
  const openEdit = (q: BankQuestion) => {
    const c = q.choices ?? [];
    setForm({
      id: q.id,
      prompt: q.prompt,
      choices: [c[0] ?? "", c[1] ?? "", c[2] ?? "", c[3] ?? ""],
      correct_index: q.correct_index,
      explanation: q.explanation ?? "",
      difficulty: q.difficulty,
    });
    setOpen(true);
  };

  const onSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await saveFn({ data: {
        id: form.id,
        bankId,
        prompt: form.prompt.trim(),
        choices: form.choices.map((c) => c.trim()) as [string, string, string, string],
        correct_index: form.correct_index,
        explanation: form.explanation.trim() || undefined,
        difficulty: form.difficulty,
        position: form.id ? questions.find((q) => q.id === form.id)?.position ?? 0 : questions.length,
      }});
      toast.success(form.id ? "Updated" : "Added");
      setOpen(false);
      refresh();
    } catch (e: any) { toast.error(e.message); }
  };

  const onDelete = async (id: string) => {
    if (!confirm("Delete this question?")) return;
    try { await delFn({ data: { id } }); refresh(); } catch (e: any) { toast.error(e.message); }
  };

  const onAddTag = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tagInput.trim()) return;
    try { await addTagFn({ data: { bankId, tag: tagInput.trim() } }); setTagInput(""); refresh(); }
    catch (e: any) { toast.error(e.message); }
  };

  const onRmTag = async (id: string) => {
    try { await rmTagFn({ data: { id } }); refresh(); } catch (e: any) { toast.error(e.message); }
  };

  if (!bank) return <div className="text-muted-foreground">Loading…</div>;

  return (
    <div className="space-y-6">
      <div>
        <Button asChild variant="ghost" size="sm">
          <Link to="/admin/banks"><ArrowLeft className="size-4 mr-1" /> All banks</Link>
        </Button>
      </div>

      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold">{bank.name}</h1>
          {bank.description && <p className="text-sm text-muted-foreground mt-1">{bank.description}</p>}
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button onClick={openNew}><Plus className="size-4 mr-1" /> Add question</Button></DialogTrigger>
          <DialogContent className="max-w-xl">
            <DialogHeader><DialogTitle>{form.id ? "Edit question" : "New question"}</DialogTitle></DialogHeader>
            <form onSubmit={onSave} className="space-y-3">
              <div>
                <Label>Prompt</Label>
                <Textarea value={form.prompt} onChange={(e) => setForm({ ...form, prompt: e.target.value })} required rows={2} maxLength={500} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                {form.choices.map((c, i) => (
                  <div key={i}>
                    <Label className="flex items-center gap-2">
                      <input
                        type="radio"
                        checked={form.correct_index === i}
                        onChange={() => setForm({ ...form, correct_index: i })}
                      />
                      Choice {i + 1} {form.correct_index === i && <Check className="size-3 text-primary" />}
                    </Label>
                    <Input
                      value={c}
                      onChange={(e) => {
                        const next = [...form.choices] as QForm["choices"];
                        next[i] = e.target.value;
                        setForm({ ...form, choices: next });
                      }}
                      required maxLength={200}
                    />
                  </div>
                ))}
              </div>
              <div>
                <Label>Explanation (optional)</Label>
                <Textarea value={form.explanation} onChange={(e) => setForm({ ...form, explanation: e.target.value })} rows={2} maxLength={500} />
              </div>
              <div>
                <Label>Difficulty (1–5)</Label>
                <Input type="number" min={1} max={5} value={form.difficulty}
                  onChange={(e) => setForm({ ...form, difficulty: Math.max(1, Math.min(5, Number(e.target.value) || 1)) })} />
              </div>
              <Button type="submit" className="w-full">{form.id ? "Save changes" : "Add question"}</Button>
            </form>
          </DialogContent>
        </Dialog>
      </header>

      <section className="glass-panel rounded-xl p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold"><TagIcon className="size-4" /> Tags</div>
        <div className="flex flex-wrap items-center gap-2">
          {tags.map((t) => (
            <Badge key={t.id} variant="secondary" className="gap-1">
              {t.tag}
              <button onClick={() => onRmTag(t.id)} className="hover:text-destructive"><X className="size-3" /></button>
            </Badge>
          ))}
          <form onSubmit={onAddTag} className="flex gap-1">
            <Input className="w-40 h-7 text-xs" placeholder="add tag" value={tagInput} onChange={(e) => setTagInput(e.target.value)} />
            <Button type="submit" size="sm" variant="outline">Add</Button>
          </form>
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="font-display text-lg font-semibold">Questions ({questions.length})</h2>
        {questions.length === 0 ? (
          <div className="rounded-xl border border-border p-6 text-center text-sm text-muted-foreground">
            No questions yet. Click "Add question" to start.
          </div>
        ) : (
          <div className="rounded-xl border border-border divide-y divide-border">
            {questions.map((q, i) => (
              <div key={q.id} className="p-3 flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="font-medium">{i + 1}. {q.prompt}</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {(q.choices ?? []).map((c, idx) => (
                      <span key={idx} className={idx === q.correct_index ? "text-primary mr-3" : "mr-3"}>
                        {idx === q.correct_index ? "✓ " : ""}{c}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button size="icon" variant="ghost" onClick={() => openEdit(q)}><Pencil className="size-4" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => onDelete(q.id)}><Trash2 className="size-4" /></Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
