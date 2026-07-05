// Shared primitives: Card, Button, SectionLabel, EmptyState, Skeleton, ErrorBanner.

export function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-xl border border-stone-200/80 bg-white p-5 shadow-sm ${className}`}>
      {children}
    </div>
  );
}

export function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-xs font-semibold uppercase tracking-wider text-stone-400">{children}</h2>
  );
}

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost";
};

export function Button({ variant = "primary", className = "", ...props }: ButtonProps) {
  const styles =
    variant === "primary"
      ? "bg-accent text-white hover:bg-accent/90 disabled:bg-accent/50"
      : variant === "secondary"
        ? "border border-accent/40 text-accent hover:bg-accent/5 disabled:opacity-50"
        : "text-stone-500 hover:text-ink hover:bg-stone-100 disabled:opacity-50";
  return (
    <button
      {...props}
      className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${styles} ${className}`}
    />
  );
}

export function EmptyState({
  title,
  hint,
  action,
}: {
  title: string;
  hint?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-dashed border-stone-300 bg-white/40 px-6 py-10 text-center">
      <p className="text-sm font-medium text-stone-500">{title}</p>
      {hint && <p className="mt-1 text-sm text-stone-400">{hint}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}

export function Skeleton({ className = "h-4 w-full" }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-stone-200/70 ${className}`} />;
}

export function SkeletonCard({ lines = 3 }: { lines?: number }) {
  return (
    <Card className="space-y-3">
      <Skeleton className="h-4 w-1/3" />
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className={i === lines - 1 ? "h-3 w-2/3" : "h-3 w-full"} />
      ))}
    </Card>
  );
}

/** Turn raw "500: {json}" API errors into a calm, readable banner. */
export function ErrorBanner({
  message,
  onDismiss,
}: {
  message: string | null;
  onDismiss?: () => void;
}) {
  if (!message) return null;
  return (
    <div className="flex items-start justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
      <span>{friendlyError(message)}</span>
      {onDismiss && (
        <button onClick={onDismiss} className="shrink-0 text-amber-500 hover:text-amber-700">
          ✕
        </button>
      )}
    </div>
  );
}

export function friendlyError(raw: string): string {
  const msg = raw.replace(/^Error:\s*/, "");
  const m = msg.match(/^(\d{3}):\s*([\s\S]*)$/);
  if (!m) {
    return /fetch|network/i.test(msg)
      ? "Can't reach the LifeOS API — is the backend running on :8000?"
      : msg;
  }
  const [, code, body] = m;
  if (code === "401" || code === "403")
    return "Not authorized — paste your API token in Settings.";
  try {
    const detail = JSON.parse(body)?.detail;
    if (typeof detail === "string") return detail;
  } catch {
    /* not JSON — fall through */
  }
  return `Something went wrong (HTTP ${code}). Try again.`;
}
