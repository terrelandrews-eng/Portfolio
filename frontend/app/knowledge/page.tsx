"use client";

import { useEffect, useMemo, useState } from "react";
import { api, Entity, Observation, SearchResult } from "@/lib/api";
import { DomainBadge } from "@/app/components/badge";
import { Button, Card, EmptyState, ErrorBanner, SectionLabel } from "@/app/components/ui";

const TYPE_ICONS: Record<string, string> = {
  person: "👤",
  pet: "🐾",
  home: "🏠",
  property: "🏠",
  vehicle: "🚗",
  appliance: "🔧",
  system: "🔧",
  place: "📍",
  organization: "🏢",
};

const STATUS_FILTERS = ["all", "proposed", "active", "retired"] as const;

function Pill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
        active
          ? "border-accent bg-accent text-white"
          : "border-stone-200 bg-white text-stone-500 hover:border-stone-300"
      }`}
    >
      {children}
    </button>
  );
}

function ConfidenceMeter({ value }: { value: number }) {
  return (
    <span className="inline-flex items-center gap-1.5" title={`confidence ${value.toFixed(2)}`}>
      <span className="h-1.5 w-14 overflow-hidden rounded-full bg-stone-200">
        <span
          className="block h-full rounded-full bg-accent/70"
          style={{ width: `${Math.round(value * 100)}%` }}
        />
      </span>
      <span className="text-[10px] tabular-nums text-stone-400">{Math.round(value * 100)}%</span>
    </span>
  );
}

export default function KnowledgePage() {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searched, setSearched] = useState(false);
  const [entities, setEntities] = useState<Entity[]>([]);
  const [observations, setObservations] = useState<Observation[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [statusFilter, setStatusFilter] = useState<(typeof STATUS_FILTERS)[number]>("all");
  const [domainFilter, setDomainFilter] = useState<string>("all");

  function loadObservations() {
    api.observations().then(setObservations).catch((e) => setError(String(e)));
  }

  useEffect(() => {
    api.entities().then(setEntities).catch((e) => setError(String(e)));
    loadObservations();
  }, []);

  async function observationAction(id: string, action: "accept" | "reject" | "retire") {
    try {
      if (action === "accept") await api.acceptObservation(id);
      else if (action === "reject") await api.rejectObservation(id);
      else await api.retireObservation(id);
      loadObservations();
    } catch (e) {
      setError(String(e));
    }
  }

  async function runSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!q.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.search(q);
      setResults(res.results);
      setSearched(true);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }

  const grouped = useMemo(
    () =>
      entities.reduce<Record<string, Entity[]>>((acc, e) => {
        (acc[e.type] ??= []).push(e);
        return acc;
      }, {}),
    [entities],
  );

  const obsDomains = useMemo(
    () => ["all", ...Array.from(new Set(observations.map((o) => o.domain))).sort()],
    [observations],
  );

  const visibleObs = observations.filter(
    (o) =>
      (statusFilter === "all" || o.status === statusFilter) &&
      (domainFilter === "all" || o.domain === domainFilter),
  );

  return (
    <main className="space-y-10">
      <section>
        <h1 className="mb-4 text-2xl font-semibold tracking-tight">Knowledge</h1>
        <form onSubmit={runSearch} className="flex gap-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="e.g. when was the HVAC serviced"
            className="flex-1 rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-sm shadow-sm focus:border-accent focus:outline-none"
          />
          <Button type="submit" disabled={loading} className="px-5">
            {loading ? "…" : "Search"}
          </Button>
        </form>

        <div className="mt-3">
          <ErrorBanner message={error} onDismiss={() => setError(null)} />
        </div>

        {searched && (
          <ul className="mt-4 space-y-2">
            {results.map((r) => (
              <li key={`${r.source}-${r.id}`} className="rounded-xl border border-stone-200 bg-white p-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium">{r.title}</span>
                  <span className="flex shrink-0 items-center gap-2">
                    <DomainBadge domain={r.domain} />
                    <span className="text-[11px] text-stone-400">
                      {r.source} · {r.score.toFixed(2)}
                    </span>
                  </span>
                </div>
                <p className="mt-1 text-sm text-stone-600">{r.snippet}</p>
              </li>
            ))}
            {!loading && results.length === 0 && (
              <EmptyState title="No results" hint="Try different words — search is hybrid keyword + semantic." />
            )}
          </ul>
        )}
      </section>

      <section>
        <SectionLabel>Entities</SectionLabel>
        <div className="mt-3 space-y-5">
          {Object.entries(grouped).map(([type, list]) => (
            <div key={type}>
              <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-stone-400">
                {TYPE_ICONS[type] ?? "•"} {type}
              </h3>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {list.map((e) => (
                  <Card key={e.id} className="p-3">
                    <span className="text-sm font-medium">{e.name}</span>
                    {e.notes && <p className="mt-0.5 text-xs leading-relaxed text-stone-500">{e.notes}</p>}
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <SectionLabel>Memory — what the system has learned</SectionLabel>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {STATUS_FILTERS.map((s) => (
            <Pill key={s} active={statusFilter === s} onClick={() => setStatusFilter(s)}>
              {s}
            </Pill>
          ))}
          <span className="mx-1 w-px bg-stone-200" />
          {obsDomains.map((d) => (
            <Pill key={d} active={domainFilter === d} onClick={() => setDomainFilter(d)}>
              {d}
            </Pill>
          ))}
        </div>

        <ul className="mt-4 space-y-2">
          {visibleObs.map((o) => (
            <li
              key={o.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-stone-200 bg-white p-4"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <DomainBadge domain={o.domain} />
                  <span className="text-[11px] text-stone-400">{o.kind}</span>
                  <ConfidenceMeter value={o.confidence} />
                  {o.status !== "active" && (
                    <span className="text-[11px] italic text-stone-400">{o.status}</span>
                  )}
                  {o.evidence_count > 1 && (
                    <span className="text-[11px] text-stone-400">seen ×{o.evidence_count}</span>
                  )}
                </div>
                <p className="mt-1.5 text-sm">{o.content}</p>
              </div>
              <span className="flex shrink-0 gap-1">
                {o.status === "proposed" && (
                  <>
                    <Button variant="secondary" onClick={() => observationAction(o.id, "accept")}>
                      Accept
                    </Button>
                    <Button variant="ghost" onClick={() => observationAction(o.id, "reject")}>
                      Reject
                    </Button>
                  </>
                )}
                {o.status === "active" && (
                  <Button variant="ghost" onClick={() => observationAction(o.id, "retire")}>
                    Retire
                  </Button>
                )}
              </span>
            </li>
          ))}
          {visibleObs.length === 0 && (
            <EmptyState
              title="Nothing here"
              hint={
                observations.length === 0
                  ? "Observations appear after weekly reviews and captured notes."
                  : "No observations match these filters."
              }
            />
          )}
        </ul>
      </section>
    </main>
  );
}
