import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { listDepartments, linkTeamsChannelToDepartment } from "@/lib/orgs.functions";
import { useEnsureCurrentOrg } from "@/hooks/use-ensure-current-org";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/teams/channel/config")({
  head: () => ({ meta: [{ title: "Configure QuizPulse — Microsoft Teams" }] }),
  component: ChannelTabConfig,
});

type Dept = { id: string; name: string; teams_channel_id: string | null };

function ChannelTabConfig() {
  const orgId = useEnsureCurrentOrg();
  const listFn = useServerFn(listDepartments);
  const linkFn = useServerFn(linkTeamsChannelToDepartment);

  const [teams, setTeams] = useState<typeof import("@microsoft/teams-js") | null>(null);
  const [ctx, setCtx] = useState<{ teamId?: string; channelId?: string; channelName?: string } | null>(null);
  const [depts, setDepts] = useState<Dept[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [status, setStatus] = useState<string>("");
  const [busy, setBusy] = useState(false);

  // 1. Initialize Teams SDK and pull channel context.
  useEffect(() => {
    (async () => {
      try {
        const t = await import("@microsoft/teams-js");
        await t.app.initialize();
        const c = await t.app.getContext();
        setTeams(t);
        setCtx({
          teamId: c.team?.groupId,
          channelId: c.channel?.id,
          channelName: c.channel?.displayName,
        });
      } catch {
        setStatus("This page must be opened from the Teams tab configuration screen.");
      }
    })();
  }, []);

  // 2. Load departments for the user's current org.
  useEffect(() => {
    if (!orgId) return;
    (async () => {
      try {
        const rows = (await listFn({ data: { orgId } })) as unknown as Dept[];
        setDepts(rows ?? []);
        // Pre-select an existing mapping for this channel, if any.
        const existing = rows?.find((d) => d.teams_channel_id === ctx?.channelId);
        if (existing) setSelected(existing.id);
      } catch (err) {
        setStatus(err instanceof Error ? err.message : "Failed to load departments");
      }
    })();
  }, [orgId, ctx?.channelId, listFn]);

  // 3. Tell Teams whether Save is allowed and what to save.
  useEffect(() => {
    if (!teams || !ctx?.channelId) return;
    const valid = Boolean(selected);
    teams.pages.config.setValidityState(valid);
    if (!valid) return;
    teams.pages.config.registerOnSaveHandler(async (saveEvent) => {
      setBusy(true);
      try {
        await linkFn({
          data: {
            departmentId: selected,
            teamsTeamId: ctx.teamId ?? "",
            teamsChannelId: ctx.channelId!,
          },
        });
        const origin = window.location.origin;
        await teams.pages.config.setConfig({
          entityId: `dept-${selected}`,
          contentUrl: `${origin}/app?dept=${selected}`,
          websiteUrl: `${origin}/app?dept=${selected}`,
          suggestedDisplayName: "QuizPulse",
        });
        saveEvent.notifySuccess();
      } catch (err) {
        const reason = err instanceof Error ? err.message : "save_failed";
        setStatus(reason);
        saveEvent.notifyFailure(reason);
      } finally {
        setBusy(false);
      }
    });
  }, [teams, ctx, selected, linkFn]);

  const channelLabel = useMemo(
    () => ctx?.channelName ?? ctx?.channelId ?? "this channel",
    [ctx],
  );

  return (
    <div className="min-h-screen bg-background text-foreground px-6 py-10">
      <div className="mx-auto max-w-md glass-panel rounded-2xl p-6 space-y-5">
        <header>
          <h1 className="font-display text-xl font-semibold">Configure QuizPulse</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Map <span className="text-foreground font-medium">{channelLabel}</span> to a
            QuizPulse department so quizzes posted in this channel stay with the right team.
          </p>
        </header>

        <div className="space-y-2">
          <Label htmlFor="dept">Department</Label>
          <Select value={selected} onValueChange={setSelected} disabled={busy || depts.length === 0}>
            <SelectTrigger id="dept">
              <SelectValue placeholder={depts.length ? "Pick a department" : "No departments yet"} />
            </SelectTrigger>
            <SelectContent>
              {depts.map((d) => (
                <SelectItem key={d.id} value={d.id}>
                  {d.name}
                  {d.teams_channel_id && d.teams_channel_id !== ctx?.channelId
                    ? " (already mapped)"
                    : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {depts.length === 0 && orgId ? (
            <p className="text-xs text-muted-foreground">
              Create a department in QuizPulse Admin first, then reopen this config.
            </p>
          ) : null}
        </div>

        {status ? (
          <p className="text-sm text-destructive break-words">{status}</p>
        ) : (
          <p className="text-xs text-muted-foreground">
            Click <strong>Save</strong> in the Teams dialog to finish.
          </p>
        )}

        {/* Standalone fallback (outside Teams): allow a direct save. */}
        {!teams ? (
          <Button
            disabled={!selected || !ctx?.channelId || busy}
            onClick={async () => {
              if (!ctx?.channelId) return;
              setBusy(true);
              try {
                await linkFn({
                  data: {
                    departmentId: selected,
                    teamsTeamId: ctx.teamId ?? "",
                    teamsChannelId: ctx.channelId,
                  },
                });
                setStatus("Saved.");
              } catch (err) {
                setStatus(err instanceof Error ? err.message : "Save failed");
              } finally {
                setBusy(false);
              }
            }}
          >
            Save mapping
          </Button>
        ) : null}
      </div>
    </div>
  );
}
