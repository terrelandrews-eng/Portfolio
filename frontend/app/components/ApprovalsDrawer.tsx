"use client";

import { useState } from "react";
import { api, Proposal } from "@/lib/api";
import { Badge, DomainBadge } from "./badge";
import { Button, EmptyState, friendlyError } from "./ui";

/** Compact key/value preview of a proposal payload (skip noisy/empty fields). */
function PayloadPreview({ payload }: { payload: Record<string, unknown> | null | undefined }) {
  const rows = Object.entries(payload ?? {}).filter(
    ([, v]) => v != null && v !== "" && typeof v !== "object",
  );
  if (rows.length === 0) return null;
  return (
    <dl className="mt-2 space-y-0.5 rounded-lg bg-stone-50 px-3 py-2 text-xs">
      {rows.slice(0, 6).map(([k, v]) => (
        <div key={k} className="flex gap-2">
          <dt className="w-24 shrink-0 text-stone-400">{k.replace(/_/g, " ")}</dt>
          <dd className="text-stone-600">{String(v)}</dd>
        </div>
      ))}
    </dl>
  );
}

export function ProposalCard({
  proposal,
  onDecided,
}: {
  proposal: Proposal;
  onDecided: (id: string, approved: boolean) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function decide(approve: boolean) {
    setBusy(true);
    setError(null);
    try {
      if (approve) await api.approveProposal(proposal.id);
      else await api.rejectProposal(proposal.id);
      onDecided(proposal.id, approve);
    } catch (e) {
      setError(friendlyError(String(e)));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-stone-200 bg-white p-4">
      <div className="flex items-center gap-2">
        <Badge tone="warn">{proposal.kind.replace(/_/g, " ")}</Badge>
        {proposal.agent && <DomainBadge domain={proposal.agent} />}
        {proposal.source && (
          <span className="text-[11px] text-stone-400">via {proposal.source}</span>
        )}
      </div>
      <p className="mt-2 text-sm text-ink">{proposal.summary}</p>
      <PayloadPreview payload={proposal.payload} />
      {error && <p className="mt-2 text-xs text-amber-700">{error}</p>}
      <div className="mt-3 flex gap-2">
        <Button onClick={() => decide(true)} disabled={busy}>
          Approve
        </Button>
        <Button variant="ghost" onClick={() => decide(false)} disabled={busy}>
          Reject
        </Button>
      </div>
    </div>
  );
}

export function ApprovalsDrawer({
  open,
  onClose,
  proposals,
  onDecided,
}: {
  open: boolean;
  onClose: () => void;
  proposals: Proposal[];
  onDecided: (id: string, approved: boolean) => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40" role="dialog" aria-label="Pending approvals">
      <div className="absolute inset-0 bg-black/20" onClick={onClose} />
      <div className="absolute inset-y-0 right-0 flex w-full max-w-md flex-col bg-base shadow-xl">
        <div className="flex items-center justify-between border-b border-stone-200/70 px-5 py-4">
          <h2 className="text-sm font-semibold text-ink">
            Pending approvals
            {proposals.length > 0 && (
              <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
                {proposals.length}
              </span>
            )}
          </h2>
          <button onClick={onClose} className="text-stone-400 hover:text-ink">
            ✕
          </button>
        </div>
        <div className="flex-1 space-y-3 overflow-y-auto p-5">
          {proposals.length === 0 ? (
            <EmptyState
              title="Nothing waiting on you"
              hint="Agents stage every external write here before it happens."
            />
          ) : (
            proposals.map((p) => <ProposalCard key={p.id} proposal={p} onDecided={onDecided} />)
          )}
        </div>
      </div>
    </div>
  );
}
