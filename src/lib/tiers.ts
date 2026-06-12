export type SubscriptionTier = "basic" | "premium" | "enterprise";

export const TIER_ORDER: Record<SubscriptionTier, number> = {
  basic: 1,
  premium: 2,
  enterprise: 3,
};

export const TIER_LABEL: Record<SubscriptionTier, string> = {
  basic: "Basic",
  premium: "Premium",
  enterprise: "Enterprise",
};

export function hasTier(current: SubscriptionTier | null | undefined, min: SubscriptionTier): boolean {
  if (!current) return false;
  return TIER_ORDER[current] >= TIER_ORDER[min];
}

export const TIER_MATRIX = [
  { feature: "General quiz engine & casual play", basic: true, premium: true, enterprise: true },
  { feature: "Public leaderboards & matchmaking", basic: true, premium: true, enterprise: true },
  { feature: "Corporate CMS (banks, documents)", basic: false, premium: true, enterprise: true },
  { feature: "AI question generation", basic: false, premium: true, enterprise: true },
  { feature: "Analytics suite", basic: false, premium: true, enterprise: true },
  { feature: "Microsoft Dataverse data sovereignty", basic: false, premium: false, enterprise: true },
  { feature: "Avatar shop, badges, challenges", basic: false, premium: false, enterprise: true },
  { feature: "Multilingual interface (i18n)", basic: false, premium: false, enterprise: true },
] as const;
