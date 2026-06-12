import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { createOrganization } from "@/lib/orgs.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useCurrentOrgId } from "@/hooks/use-current-org";

export const Route = createFileRoute("/_authenticated/onboarding")({
  head: () => ({ meta: [{ title: "Set up your organization — QuizPulse" }] }),
  component: OnboardingPage,
});

function slugify(s: string) {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
}

function OnboardingPage() {
  const navigate = useNavigate();
  const createFn = useServerFn(createOrganization);
  const [, setCurrentOrg] = useCurrentOrgId();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [saving, setSaving] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return toast.error("Company name required");
    setSaving(true);
    try {
      const org = await createFn({
        data: { name: name.trim(), slug: slug || slugify(name) },
      });
      setCurrentOrg((org as any).id);
      toast.success("Organization created");
      navigate({ to: "/admin" });
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen grid place-items-center px-4">
      <div className="w-full max-w-md">
        <Link to="/app" className="text-sm text-muted-foreground hover:underline">
          ← back to dashboard
        </Link>
        <div className="glass-panel rounded-xl p-6 mt-3">
          <h1 className="font-display text-2xl font-bold">Create your organization</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Spin up a workspace for your team. You'll be the owner.
          </p>
          <form onSubmit={onSubmit} className="space-y-3 mt-5">
            <div>
              <Label>Company name</Label>
              <Input
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (!slug) setSlug(slugify(e.target.value));
                }}
                maxLength={120}
                required
              />
            </div>
            <div>
              <Label>URL slug</Label>
              <Input
                value={slug}
                onChange={(e) => setSlug(slugify(e.target.value))}
                placeholder="acme-corp"
                maxLength={40}
                required
              />
              <p className="text-xs text-muted-foreground mt-1">
                Lowercase letters, numbers, and hyphens only.
              </p>
            </div>
            <Button type="submit" className="w-full" disabled={saving}>
              {saving ? "Creating…" : "Create organization"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
