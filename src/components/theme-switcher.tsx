import { useEffect, useState } from "react";
import { Palette } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

export const THEMES = [
  { id: "midnight", label: "Midnight" },
  { id: "ocean", label: "Ocean" },
  { id: "neon", label: "Neon" },
  { id: "sunset", label: "Sunset" },
] as const;
const KEY = "qp.theme";

export function applyStoredTheme() {
  if (typeof window === "undefined") return;
  const t = localStorage.getItem(KEY);
  if (t && t !== "midnight") document.documentElement.dataset.theme = t;
  else delete document.documentElement.dataset.theme;
}

export function ThemeSwitcher() {
  const [theme, setTheme] = useState("midnight");
  useEffect(() => { setTheme(localStorage.getItem(KEY) ?? "midnight"); }, []);
  const pick = (id: string) => { localStorage.setItem(KEY, id); setTheme(id); applyStoredTheme(); };
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" aria-label="Change theme"><Palette className="size-4 mr-1" /> Theme</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        {THEMES.map((t) => (
          <DropdownMenuItem key={t.id} onClick={() => pick(t.id)}>{theme === t.id ? "✓ " : ""}{t.label}</DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
