// Muted per-domain color badges — the one consistent color signal across screens.

const DOMAIN_STYLES: Record<string, string> = {
  family: "bg-rose-50 text-rose-700 border-rose-200",
  health: "bg-emerald-50 text-emerald-700 border-emerald-200",
  meals: "bg-amber-50 text-amber-700 border-amber-200",
  home: "bg-sky-50 text-sky-700 border-sky-200",
  faith: "bg-violet-50 text-violet-700 border-violet-200",
  finance: "bg-teal-50 text-teal-700 border-teal-200",
  business: "bg-indigo-50 text-indigo-700 border-indigo-200",
};

const FALLBACK = "bg-stone-100 text-stone-600 border-stone-200";

export function DomainBadge({ domain }: { domain?: string | null }) {
  if (!domain) return null;
  const style = DOMAIN_STYLES[domain] ?? FALLBACK;
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${style}`}>
      {domain}
    </span>
  );
}

/** Generic badge for non-domain labels (proposal kinds, statuses…). */
export function Badge({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "accent" | "warn";
}) {
  const style =
    tone === "accent"
      ? "bg-accent/10 text-accent border-accent/20"
      : tone === "warn"
        ? "bg-amber-50 text-amber-700 border-amber-200"
        : FALLBACK;
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${style}`}>
      {children}
    </span>
  );
}
