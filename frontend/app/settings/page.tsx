"use client";

import { useEffect, useState } from "react";
import { AdminCost, api, FinanceSummary, getToken, Healthz, setToken } from "@/lib/api";
import { Button, Card, ErrorBanner, SectionLabel } from "@/app/components/ui";
import { humanDate } from "@/lib/format";

function StatusCard({
  label,
  value,
  ok,
}: {
  label: string;
  value: string;
  ok: boolean | null; // null = informational, no good/bad judgment
}) {
  return (
    <Card className="flex items-center gap-3 p-4">
      <span
        className={`h-2.5 w-2.5 shrink-0 rounded-full ${
          ok === null ? "bg-stone-300" : ok ? "bg-emerald-500" : "bg-amber-500"
        }`}
      />
      <div className="min-w-0">
        <p className="text-xs text-stone-400">{label}</p>
        <p className="truncate text-sm font-medium">{value}</p>
      </div>
    </Card>
  );
}

export default function SettingsPage() {
  const [token, setTokenInput] = useState("");
  const [priorities, setPriorities] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [health, setHealth] = useState<Healthz | null>(null);
  const [cost, setCost] = useState<AdminCost | null>(null);
  const [finance, setFinance] = useState<FinanceSummary | null>(null);

  function loadAll() {
    api.getPriorities().then((p) => setPriorities(p.content)).catch(() => {});
    api.health().then(setHealth).catch(() => setHealth(null));
    api.adminCost().then(setCost).catch(() => {});
    api.financeSummary().then(setFinance).catch(() => {});
  }

  useEffect(() => {
    setTokenInput(getToken());
    loadAll();
  }, []);

  async function importCsv(file: File) {
    setError(null);
    try {
      const res = await api.financeImport(file);
      setFinance(res.month_summary);
      setStatus(`Imported ${res.imported} transactions (${res.skipped} duplicates skipped).`);
    } catch (e) {
      setError(String(e));
    }
  }

  function saveToken() {
    setToken(token);
    setStatus("Token saved.");
    loadAll(); // re-fetch now that auth may work
  }

  async function savePriorities() {
    setError(null);
    try {
      await api.updatePriorities(priorities);
      setStatus("Priorities saved (new version created).");
    } catch (e) {
      setError(String(e));
    }
  }

  function nextRun(iso: string | null): string {
    if (!iso) return "not scheduled";
    const d = new Date(iso);
    return `${humanDate(iso)} · ${d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`;
  }

  return (
    <main className="space-y-10">
      <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>

      <ErrorBanner message={error} onDismiss={() => setError(null)} />
      {status && <p className="text-sm font-medium text-accent">{status}</p>}

      <section>
        <SectionLabel>System status</SectionLabel>
        {health ? (
          <>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <StatusCard label="API" value={health.status} ok={health.status === "ok"} />
              <StatusCard label="Database" value={health.db ? "connected" : "unreachable"} ok={health.db} />
              <StatusCard
                label="LLM"
                value={health.llm}
                ok={health.mock_integrations ? null : health.llm === "anthropic"}
              />
              <StatusCard
                label="Embeddings"
                value={health.embeddings}
                ok={health.mock_integrations ? null : health.embeddings === "voyage"}
              />
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <StatusCard
                label="Mode"
                value={health.mock_integrations ? "mock — runs offline, no keys" : "live integrations"}
                ok={null}
              />
              <Card className="p-4">
                <p className="text-xs text-stone-400">
                  Scheduler {health.scheduler.running ? "· running" : "· stopped"}
                </p>
                {health.scheduler.jobs.length === 0 ? (
                  <p className="text-sm font-medium">no jobs</p>
                ) : (
                  <ul className="mt-1 space-y-0.5 text-sm">
                    {health.scheduler.jobs.map((j) => (
                      <li key={j.id} className="flex justify-between gap-3">
                        <span className="font-medium">{j.id.replace(/_/g, " ")}</span>
                        <span className="text-xs text-stone-400">{nextRun(j.next_run)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            </div>
          </>
        ) : (
          <p className="mt-3 text-sm text-stone-400">
            Can&apos;t reach the API — check the token below and that the backend is running on :8000.
          </p>
        )}
      </section>

      {cost && cost.runs > 0 && (
        <section>
          <SectionLabel>Agent usage</SectionLabel>
          <Card className="mt-3 p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-stone-100 text-left text-xs text-stone-400">
                  <th className="px-4 py-2.5 font-medium">Agent</th>
                  <th className="px-4 py-2.5 text-right font-medium">Runs</th>
                  <th className="px-4 py-2.5 text-right font-medium">Tokens</th>
                </tr>
              </thead>
              <tbody>
                {cost.by_agent.map((a) => (
                  <tr key={a.agent} className="border-b border-stone-50">
                    <td className="px-4 py-2 font-medium">{a.agent.replace(/_/g, " ")}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{a.runs}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{a.tokens.toLocaleString()}</td>
                  </tr>
                ))}
                <tr className="text-stone-500">
                  <td className="px-4 py-2">
                    Total {cost.errors > 0 && <span className="text-amber-600">· {cost.errors} errors</span>}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">{cost.runs}</td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    {(cost.tokens_in + cost.tokens_out).toLocaleString()}
                  </td>
                </tr>
              </tbody>
            </table>
          </Card>
        </section>
      )}

      <section>
        <SectionLabel>API token</SectionLabel>
        <p className="mt-2 text-sm text-stone-500">
          Single-user bearer token — matches <code className="rounded bg-stone-100 px-1">API_TOKEN</code> in
          the backend .env.
        </p>
        <div className="mt-2 flex gap-2">
          <input
            value={token}
            onChange={(e) => setTokenInput(e.target.value)}
            className="flex-1 rounded-lg border border-stone-200 bg-white px-3 py-2 font-mono text-sm focus:border-accent focus:outline-none"
            placeholder="dev-local-token-change-me"
          />
          <Button onClick={saveToken}>Save</Button>
        </div>
      </section>

      <section>
        <SectionLabel>Priorities</SectionLabel>
        <p className="mt-2 text-sm text-stone-500">
          Every agent reads the active version. Editing creates a new version.
        </p>
        <textarea
          value={priorities}
          onChange={(e) => setPriorities(e.target.value)}
          rows={12}
          className="mt-2 w-full rounded-lg border border-stone-200 bg-white px-3 py-2 font-mono text-xs leading-relaxed focus:border-accent focus:outline-none"
        />
        <Button onClick={savePriorities} className="mt-2">
          Save priorities
        </Button>
      </section>

      <section>
        <SectionLabel>Finance import</SectionLabel>
        <p className="mt-2 text-sm text-stone-500">
          Upload a bank/card CSV (date, description, amount) — normalized, categorized, and summarized.
        </p>
        <input
          type="file"
          accept=".csv,text/csv"
          onChange={(e) => e.target.files?.[0] && importCsv(e.target.files[0])}
          className="mt-2 text-sm"
        />
        {finance && (
          <Card className="mt-3 max-w-md">
            <div className="mb-2 flex items-baseline justify-between">
              <span className="text-sm font-semibold">{finance.month}</span>
              <span className="text-sm tabular-nums">
                ${finance.total.toFixed(2)}{" "}
                <span className="text-xs text-stone-400">/ {finance.transaction_count} txns</span>
              </span>
            </div>
            <ul className="space-y-1 text-sm text-stone-600">
              {Object.entries(finance.by_category).map(([cat, amt]) => (
                <li key={cat} className="flex justify-between">
                  <span>{cat}</span>
                  <span className="tabular-nums">${amt.toFixed(2)}</span>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </section>
    </main>
  );
}
