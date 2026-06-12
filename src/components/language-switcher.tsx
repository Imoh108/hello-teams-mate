import { useTranslation } from "react-i18next";
import { SUPPORTED_LOCALES } from "@/lib/i18n";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Languages } from "lucide-react";

export function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const { i18n } = useTranslation();
  const current = i18n.resolvedLanguage || i18n.language || "en";
  return (
    <Select value={current} onValueChange={(v) => i18n.changeLanguage(v)}>
      <SelectTrigger className={compact ? "w-[110px] h-8" : "w-[140px]"}>
        <Languages className="size-4 mr-1" />
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {SUPPORTED_LOCALES.map((l) => (
          <SelectItem key={l.code} value={l.code}>{l.label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
