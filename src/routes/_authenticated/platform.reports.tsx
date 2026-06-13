import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { FileDown, FileSpreadsheet } from "lucide-react";
import { generateUsageReport, listOrgsForReport } from "@/lib/platform-reports.functions";

export const Route = createFileRoute("/_authenticated/platform/reports")({
  component: ReportsPage,
});

type Orgs = Awaited<ReturnType<typeof listOrgsForReport>>;

function ReportsPage() {
  const [orgs, setOrgs] = useState<Orgs>([]);
  const [orgId, setOrgId] = useState<string>("__all__");
  const [days, setDays] = useState(30);
  const [busy, setBusy] = useState(false);
  const [last, setLast] = useState<{ total: number; uniqueUsers: number; filename: string } | null>(null);

  useEffect(() => { listOrgsForReport().then((o) => setOrgs(o)).catch(() => {}); }, []);

  async function download() {
    setBusy(true);
    try {
      const res = await generateUsageReport({
        data: { orgId: orgId === "__all__" ? null : orgId, days },
      });
      const blob = new Blob([res.csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = res.filename; a.click();
      URL.revokeObjectURL(url);
      setLast({ total: res.total, uniqueUsers: res.uniqueUsers, filename: res.filename });
      toast.success("Report downloaded");
    } catch (e: any) { toast.error(e?.message ?? "Failed"); }
    finally { setBusy(false); }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold">Usage reports</h1>
        <p className="text-sm text-muted-foreground">
          Generate downloadable CSV reports for a client org or the entire platform.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <FileSpreadsheet className="size-4" /> New report
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Scope</Label>
            <Select value={orgId} onValueChange={setOrgId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Platform-wide</SelectItem>
                {orgs.map((o) => (
                  <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Window (days)</Label>
            <Input type="number" min={1} max={365} value={days}
              onChange={(e) => setDays(Math.max(1, Math.min(365, Number(e.target.value) || 30)))} />
          </div>
          <Button onClick={download} disabled={busy}>
            <FileDown className="size-4 mr-1" /> {busy ? "Generating…" : "Download CSV"}
          </Button>
        </CardContent>
      </Card>

      {last && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Last report</CardTitle></CardHeader>
          <CardContent className="text-sm space-y-1">
            <div><span className="text-muted-foreground">File:</span> {last.filename}</div>
            <div><span className="text-muted-foreground">Total events:</span> {last.total.toLocaleString()}</div>
            <div><span className="text-muted-foreground">Unique users:</span> {last.uniqueUsers.toLocaleString()}</div>
          </CardContent>
        </Card>
      )}

      <p className="text-xs text-muted-foreground">
        CSV includes a daily activity breakdown and a top-events table. Share with
        client leadership or import into a spreadsheet for further analysis.
      </p>
    </div>
  );
}
