import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  listDocuments, registerDocument, setDocumentExtractedText, deleteDocument, listBanks,
} from "@/lib/cms.functions";
import { useCurrentOrgId } from "@/hooks/use-current-org";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { FileText, Upload, Trash2, FileEdit } from "lucide-react";
import type { QuestionBank, TrainingDocument } from "@/lib/data/types";

export const Route = createFileRoute("/_authenticated/admin/documents")({
  component: DocumentsPage,
});

const ACCEPT = ".pdf,.docx,.txt,.md,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/markdown";
const MAX_BYTES = 20 * 1024 * 1024; // 20 MB

function DocumentsPage() {
  const [orgId] = useCurrentOrgId();
  const docsFn = useServerFn(listDocuments);
  const banksFn = useServerFn(listBanks);
  const registerFn = useServerFn(registerDocument);
  const setTextFn = useServerFn(setDocumentExtractedText);
  const delFn = useServerFn(deleteDocument);

  const [docs, setDocs] = useState<TrainingDocument[]>([]);
  const [banks, setBanks] = useState<QuestionBank[]>([]);
  const [bankId, setBankId] = useState<string>("");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const [editing, setEditing] = useState<TrainingDocument | null>(null);
  const [editText, setEditText] = useState("");

  const refresh = async () => {
    if (!orgId) return;
    const [d, b] = await Promise.all([
      docsFn({ data: { orgId } }),
      banksFn({ data: { orgId } }),
    ]);
    setDocs(d as TrainingDocument[]);
    setBanks(b as QuestionBank[]);
  };
  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, [orgId]);

  const onUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !orgId) return;
    if (file.size > MAX_BYTES) { toast.error("File too large (max 20 MB)"); return; }
    setUploading(true);
    try {
      const safeName = file.name.replace(/[^\w.\- ]+/g, "_");
      const path = `${orgId}/${Date.now()}_${safeName}`;
      const { error: upErr } = await supabase.storage
        .from("training-documents").upload(path, file, { contentType: file.type, upsert: false });
      if (upErr) throw upErr;
      const doc = await registerFn({ data: {
        orgId,
        bankId: bankId || null,
        file_name: file.name,
        file_path: path,
        mime_type: file.type || "application/octet-stream",
        size_bytes: file.size,
      }}) as TrainingDocument;
      // Auto-parse plain text client-side
      if (file.type.startsWith("text/") || /\.(txt|md)$/i.test(file.name)) {
        const text = await file.text();
        await setTextFn({ data: { id: doc.id, text: text.slice(0, 500_000) } });
      }
      toast.success("Uploaded");
      if (fileRef.current) fileRef.current.value = "";
      refresh();
    } catch (err: any) {
      toast.error(err.message ?? "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const onDelete = async (id: string) => {
    if (!confirm("Delete this document?")) return;
    try { await delFn({ data: { id } }); refresh(); } catch (e: any) { toast.error(e.message); }
  };

  const openEdit = (doc: TrainingDocument) => {
    setEditing(doc); setEditText(doc.extracted_text ?? "");
  };
  const saveText = async () => {
    if (!editing) return;
    try {
      await setTextFn({ data: { id: editing.id, text: editText.slice(0, 500_000) } });
      toast.success("Text saved");
      setEditing(null);
      refresh();
    } catch (e: any) { toast.error(e.message); }
  };

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-bold flex items-center gap-2">
          <FileText className="size-6" /> Training documents
        </h1>
        <p className="text-sm text-muted-foreground">Upload PDFs, Word docs, or text files. Use the extracted text to power AI question generation later.</p>
      </header>

      <section className="glass-panel rounded-xl p-4 space-y-3">
        <h2 className="font-semibold">Upload a document</h2>
        <div className="grid gap-3 md:grid-cols-[1fr_220px_auto]">
          <div>
            <Label className="text-xs">File</Label>
            <Input ref={fileRef} type="file" accept={ACCEPT} onChange={onUpload} disabled={uploading} />
          </div>
          <div>
            <Label className="text-xs">Attach to bank (optional)</Label>
            <Select value={bankId || "none"} onValueChange={(v) => setBankId(v === "none" ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="— None —" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— None —</SelectItem>
                {banks.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
            <Button disabled={uploading} variant="outline" onClick={() => fileRef.current?.click()}>
              <Upload className="size-4 mr-1" /> {uploading ? "Uploading…" : "Choose file"}
            </Button>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          .txt / .md auto-extract. For .pdf and .docx, paste the extracted text after upload to make it AI-ready.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="font-display text-lg font-semibold">Library ({docs.length})</h2>
        {docs.length === 0 ? (
          <div className="rounded-xl border border-border p-6 text-center text-sm text-muted-foreground">
            No documents yet.
          </div>
        ) : (
          <div className="rounded-xl border border-border divide-y divide-border">
            {docs.map((d) => (
              <div key={d.id} className="p-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-medium truncate">{d.file_name}</div>
                  <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2">
                    <Badge variant={d.status === "ready" ? "default" : "secondary"}>{d.status}</Badge>
                    <span>{(d.size_bytes / 1024).toFixed(1)} KB</span>
                    {d.extracted_text && <span>· {d.extracted_text.length.toLocaleString()} chars</span>}
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button size="icon" variant="ghost" onClick={() => openEdit(d)} title="Edit extracted text">
                    <FileEdit className="size-4" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => onDelete(d.id)}>
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Extracted text — {editing?.file_name}</DialogTitle></DialogHeader>
          <Textarea
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            rows={16}
            placeholder="Paste or edit the extracted text here…"
          />
          <Button onClick={saveText}>Save text</Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
