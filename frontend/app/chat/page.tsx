"use client";

import { useMemo, useRef, useState } from "react";
import { api, chatStream, Proposal } from "@/lib/api";

interface Msg {
  role: "user" | "assistant" | "system";
  content: string;
  agent?: string;
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [error, setError] = useState<string | null>(null);
  const sessionId = useMemo(() => Math.random().toString(36).slice(2), []);
  const agentRef = useRef<string | undefined>(undefined);

  function addProposals(ps: Proposal[]) {
    setProposals((cur) => {
      const seen = new Set(cur.map((p) => p.id));
      return [...cur, ...ps.filter((p) => !seen.has(p.id))];
    });
  }

  async function send() {
    const text = input.trim();
    if (!text || streaming) return;
    setInput("");
    setError(null);
    setMessages((m) => [...m, { role: "user", content: text }]);

    // "note:" prefix routes to quick-capture instead of chat (spec §9.3).
    if (text.toLowerCase().startsWith("note:")) {
      try {
        const res = await api.capture(text);
        addProposals(res.proposals);
        setMessages((m) => [
          ...m,
          { role: "system", content: `Captured — ${res.proposals.length} item(s) staged below for review.` },
        ]);
      } catch (e) {
        setError(String(e));
      }
      return;
    }

    setStreaming(true);
    agentRef.current = undefined;
    setMessages((m) => [...m, { role: "assistant", content: "", agent: undefined }]);
    try {
      await chatStream(
        sessionId,
        text,
        (t) =>
          setMessages((m) => {
            const copy = [...m];
            copy[copy.length - 1] = { ...copy[copy.length - 1], content: copy[copy.length - 1].content + t };
            return copy;
          }),
        (meta) => {
          agentRef.current = meta.agent as string;
          setMessages((m) => {
            const copy = [...m];
            copy[copy.length - 1] = { ...copy[copy.length - 1], agent: meta.agent as string };
            return copy;
          });
        },
        (ps) => addProposals(ps),
      );
    } catch (e) {
      setError(String(e));
    } finally {
      setStreaming(false);
    }
  }

  async function decide(id: string, approve: boolean) {
    try {
      if (approve) await api.approveProposal(id);
      else await api.rejectProposal(id);
      setProposals((cur) => cur.filter((p) => p.id !== id));
    } catch (e) {
      setError(String(e));
    }
  }

  return (
    <main className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Chat</h1>
        <span className="text-xs text-gray-400">
          Prefix with <code>note:</code> to capture a thought
        </span>
      </div>

      {error && <p className="text-sm text-amber-700">{error}</p>}

      <section className="space-y-3">
        {messages.length === 0 && (
          <p className="text-sm text-gray-500">
            Ask anything, or try &quot;plan a date night for Friday&quot;.
          </p>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            className={
              m.role === "user"
                ? "ml-auto max-w-[80%] rounded-lg bg-accent px-3 py-2 text-sm text-white"
                : m.role === "system"
                  ? "text-center text-xs text-gray-400"
                  : "max-w-[85%] rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
            }
          >
            {m.role === "assistant" && m.agent && (
              <div className="mb-0.5 text-xs font-medium text-accent">{m.agent}</div>
            )}
            <div className="whitespace-pre-wrap">{m.content || (streaming ? "…" : "")}</div>
          </div>
        ))}
      </section>

      {proposals.length > 0 && (
        <section className="rounded-lg border border-amber-200 bg-amber-50/50 p-3">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-amber-700">
            Pending approvals
          </h2>
          <ul className="space-y-2">
            {proposals.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 rounded border border-amber-200 bg-white p-2 text-sm">
                <span>
                  <span className="text-xs text-gray-400">[{p.kind}] </span>
                  {p.summary}
                </span>
                <span className="flex shrink-0 gap-2">
                  <button onClick={() => decide(p.id, true)} className="text-xs text-accent hover:underline">
                    Approve
                  </button>
                  <button onClick={() => decide(p.id, false)} className="text-xs text-gray-400 hover:underline">
                    Reject
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
        className="sticky bottom-4 flex gap-2"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Message, or note: something to remember…"
          className="flex-1 rounded border border-gray-300 px-3 py-2 text-sm shadow-sm"
        />
        <button type="submit" disabled={streaming} className="rounded bg-accent px-4 py-2 text-sm text-white">
          {streaming ? "…" : "Send"}
        </button>
      </form>
    </main>
  );
}
