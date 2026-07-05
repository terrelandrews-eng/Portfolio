"use client";

import { useEffect, useState } from "react";
import { api, FinanceSummary, getToken, setToken } from "@/lib/api";

export default function SettingsPage() {
  const [token, setTokenInput] = useState("");
  const [priorities, setPriorities] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [health, setHealth] = useState<Record<string, unknown> | null>(null);
  const [finance, setFinance] = useState<FinanceSummary | null>(null);

  useEffect(() => {
    setTokenInput(getToken());
    api.getPriorities().then((p) => setPriorities(p.content)).catch(() => {});
    api.health().then(setHealth).catch(() => {});
    api.financeSummary().then(setFinance).catch(() => {});
  }, []);

  async function importCsv(file: File) {
    try {
      const res = await api.financeImport(file);
      setFinance(res.month_summary);
      setStatus(`Imported ${res.imported} transactions (${res.skipped} duplicates skipped).`);
    } catch (e) {
      setStatus(String(e));
    }
  }

  function saveToken() {
    setToken(token);
    setStatus("Token saved.");
  }

  async function savePriorities() {
    try {
      await api.updatePriorities(priorities);
      setStatus("Priorities saved (new version created).");
    } catch (e) {
      setStatus(String(e));
    }
  }

  return (
    <main className="space-y-10">
      <section>
        <h1 className="mb-3 text-lg font-semibold">API token</h1>
        <p className="mb-2 text-sm text-gray-600">
          Single-user bearer token. Matches <code>API_TOKEN</code> in your .env.
        </p>
        <div className="flex gap-2">
          <input
            value={token}
            onChange={(e) => setTokenInput(e.target.value)}
            className="flex-1 rounded border border-gray-300 px-3 py-2 text-sm"
            placeholder="dev-local-token-change-me"
          />
          <button onClick={saveToken} className="rounded bg-accent px-4 py-2 text-sm text-white">
            Save
          </button>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Priorities</h2>
        <p className="mb-2 text-sm text-gray-600">
          Editing creates a new version. Every agent reads the active version.
        </p>
        <textarea
          value={priorities}
          onChange={(e) => setPriorities(e.target.value)}
          rows={12}
          className="w-full rounded border border-gray-300 px-3 py-2 font-mono text-xs"
        />
        <button
          onClick={savePriorities}
          className="mt-2 rounded bg-accent px-4 py-2 text-sm text-white"
        >
          Save priorities
        </button>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Finance import</h2>
        <p className="mb-2 text-sm text-gray-600">
          Upload a bank/card CSV (date, description, amount). Normalized into transactions;
          monthly spend is computed below.
        </p>
        <input
          type="file"
          accept=".csv,text/csv"
          onChange={(e) => e.target.files?.[0] && importCsv(e.target.files[0])}
          className="text-sm"
        />
        {finance && (
          <div className="mt-3 rounded border border-gray-200 bg-white p-3 text-sm">
            <div className="mb-1 font-medium">
              {finance.month}: ${finance.total.toFixed(2)} across {finance.transaction_count} transactions
            </div>
            <ul className="space-y-0.5 text-xs text-gray-600">
              {Object.entries(finance.by_category).map(([cat, amt]) => (
                <li key={cat} className="flex justify-between">
                  <span>{cat}</span>
                  <span>${amt.toFixed(2)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Status</h2>
        <pre className="rounded bg-white/60 p-3 text-xs">
          {health ? JSON.stringify(health, null, 2) : "—"}
        </pre>
      </section>

      {status && <p className="text-sm text-accent">{status}</p>}
    </main>
  );
}
