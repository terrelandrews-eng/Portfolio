"use client";

import { useEffect, useState } from "react";
import { api, Entity, Observation, SearchResult } from "@/lib/api";

export default function KnowledgePage() {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [entities, setEntities] = useState<Entity[]>([]);
  const [observations, setObservations] = useState<Observation[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function loadObservations() {
    api.observations().then(setObservations).catch((e) => setError(String(e)));
  }

  useEffect(() => {
    api
      .entities()
      .then(setEntities)
      .catch((e) => setError(String(e)));
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
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }

  const grouped = entities.reduce<Record<string, Entity[]>>((acc, e) => {
    (acc[e.type] ??= []).push(e);
    return acc;
  }, {});

  return (
    <main className="space-y-10">
      <section>
        <h1 className="mb-3 text-lg font-semibold">Search knowledge</h1>
        <form onSubmit={runSearch} className="flex gap-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="e.g. when was the HVAC serviced"
            className="flex-1 rounded border border-gray-300 px-3 py-2 text-sm"
          />
          <button
            type="submit"
            className="rounded bg-accent px-4 py-2 text-sm text-white"
          >
            {loading ? "…" : "Search"}
          </button>
        </form>

        {error && <p className="mt-3 text-sm text-amber-700">{error}</p>}

        <ul className="mt-4 space-y-3">
          {results.map((r) => (
            <li key={`${r.source}-${r.id}`} className="rounded border border-gray-200 p-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{r.title}</span>
                <span className="text-xs text-gray-500">
                  {r.source} · {r.score.toFixed(2)}
                </span>
              </div>
              <p className="mt-1 text-sm text-gray-700">{r.snippet}</p>
            </li>
          ))}
          {!loading && q && results.length === 0 && !error && (
            <li className="text-sm text-gray-500">No results.</li>
          )}
        </ul>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Entities</h2>
        {Object.entries(grouped).map(([type, list]) => (
          <div key={type} className="mb-4">
            <h3 className="mb-1 text-xs uppercase tracking-wide text-gray-500">
              {type}
            </h3>
            <ul className="space-y-1">
              {list.map((e) => (
                <li key={e.id} className="rounded bg-white/60 px-3 py-2 text-sm">
                  <span className="font-medium">{e.name}</span>
                  {e.notes && <span className="text-gray-600"> — {e.notes}</span>}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Memory (observations)</h2>
        <p className="mb-3 text-sm text-gray-500">
          What the system has learned. Accept proposals, or retire what&apos;s stale.
        </p>
        <ul className="space-y-2">
          {observations.map((o) => (
            <li
              key={o.id}
              className="flex items-center justify-between gap-3 rounded border border-gray-200 p-3 text-sm"
            >
              <span>
                <span className="text-xs text-gray-400">
                  [{o.domain} · {o.kind} · {o.confidence.toFixed(2)} · {o.status}]{" "}
                </span>
                {o.content}
              </span>
              <span className="flex shrink-0 gap-2">
                {o.status === "proposed" && (
                  <>
                    <button
                      onClick={() => observationAction(o.id, "accept")}
                      className="text-xs text-accent hover:underline"
                    >
                      Accept
                    </button>
                    <button
                      onClick={() => observationAction(o.id, "reject")}
                      className="text-xs text-gray-400 hover:underline"
                    >
                      Reject
                    </button>
                  </>
                )}
                {o.status === "active" && (
                  <button
                    onClick={() => observationAction(o.id, "retire")}
                    className="text-xs text-gray-400 hover:underline"
                  >
                    Retire
                  </button>
                )}
              </span>
            </li>
          ))}
          {observations.length === 0 && (
            <li className="text-sm text-gray-500">No observations yet.</li>
          )}
        </ul>
      </section>
    </main>
  );
}
