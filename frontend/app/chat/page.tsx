"use client";

import { useEffect, useRef, useState } from "react";
import { api, chatStream, Proposal } from "@/lib/api";
import { ProposalCard } from "@/app/components/ApprovalsDrawer";
import { Md } from "@/app/components/markdown";
import { Button, ErrorBanner } from "@/app/components/ui";

interface Msg {
  role: "user" | "assistant" | "system";
  content: string;
  agent?: string;
}

const STORE_KEY = "lifeos_chat_v1";

function newSessionId() {
  return Math.random().toString(36).slice(2);
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [sessionId, setSessionId] = useState("");
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  // Restore the conversation (survives navigation); localStorage only exists client-side.
  useEffect(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem(STORE_KEY) ?? "null");
      if (saved?.sessionId && Array.isArray(saved.messages)) {
        setSessionId(saved.sessionId);
        setMessages(saved.messages);
      } else {
        setSessionId(newSessionId());
      }
    } catch {
      setSessionId(newSessionId());
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STORE_KEY, JSON.stringify({ sessionId, messages }));
    } catch {
      /* storage blocked — chat stays in-memory */
    }
  }, [hydrated, sessionId, messages]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, proposals]);

  function newChat() {
    setMessages([]);
    setProposals([]);
    setError(null);
    setSessionId(newSessionId());
  }

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
          {
            role: "system",
            content: `Captured — ${res.proposals.length} item(s) staged below for review.`,
          },
        ]);
      } catch (e) {
        setError(String(e));
      }
      return;
    }

    setStreaming(true);
    setMessages((m) => [...m, { role: "assistant", content: "" }]);
    try {
      await chatStream(
        sessionId,
        text,
        (t) =>
          setMessages((m) => {
            const copy = [...m];
            const last = copy[copy.length - 1];
            copy[copy.length - 1] = { ...last, content: last.content + t };
            return copy;
          }),
        (meta) =>
          setMessages((m) => {
            const copy = [...m];
            copy[copy.length - 1] = { ...copy[copy.length - 1], agent: meta.agent as string };
            return copy;
          }),
        (ps) => addProposals(ps),
      );
    } catch (e) {
      setError(String(e));
    } finally {
      setStreaming(false);
    }
  }

  return (
    <main className="flex min-h-[calc(100vh-8rem)] flex-col space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Chat</h1>
        <div className="flex items-center gap-3">
          <span className="hidden text-xs text-stone-400 sm:inline">
            Prefix with <code className="rounded bg-stone-100 px-1">note:</code> to capture
          </span>
          {messages.length > 0 && (
            <Button variant="ghost" onClick={newChat}>
              New chat
            </Button>
          )}
        </div>
      </div>

      <ErrorBanner message={error} onDismiss={() => setError(null)} />

      <section className="flex-1 space-y-3">
        {hydrated && messages.length === 0 && (
          <div className="rounded-xl border border-dashed border-stone-300 bg-white/40 px-6 py-10 text-center text-sm text-stone-400">
            <p className="font-medium text-stone-500">Talk to your chief of staff</p>
            <p className="mt-1">
              Try <button onClick={() => setInput("plan a date night for Friday")} className="text-accent underline underline-offset-2">“plan a date night for Friday”</button>{" "}
              — it routes to the right domain agent.
            </p>
          </div>
        )}
        {messages.map((m, i) => {
          if (m.role === "system")
            return (
              <div key={i} className="text-center text-xs text-stone-400">
                {m.content}
              </div>
            );
          if (m.role === "user")
            return (
              <div
                key={i}
                className="ml-auto w-fit max-w-[80%] rounded-2xl rounded-br-md bg-accent px-4 py-2.5 text-sm text-white"
              >
                {m.content}
              </div>
            );
          return (
            <div
              key={i}
              className="w-fit max-w-[85%] rounded-2xl rounded-bl-md border border-stone-200 bg-white px-4 py-2.5"
            >
              {m.agent && (
                <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-accent/70">
                  {m.agent.replace(/_/g, " ")}
                </div>
              )}
              {m.content ? (
                <Md>{m.content}</Md>
              ) : (
                <span className="text-sm text-stone-400">{streaming ? "…" : ""}</span>
              )}
            </div>
          );
        })}

        {proposals.length > 0 && (
          <div className="space-y-2 pt-1">
            <p className="text-xs font-medium uppercase tracking-wider text-amber-600">
              Waiting for your approval
            </p>
            {proposals.map((p) => (
              <ProposalCard
                key={p.id}
                proposal={p}
                onDecided={(id) => setProposals((cur) => cur.filter((x) => x.id !== id))}
              />
            ))}
          </div>
        )}
        <div ref={endRef} />
      </section>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
        className="sticky bottom-16 flex gap-2 md:bottom-4"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Message, or note: something to remember…"
          className="flex-1 rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-sm shadow-sm focus:border-accent focus:outline-none"
        />
        <Button type="submit" disabled={streaming} className="px-5">
          {streaming ? "…" : "Send"}
        </Button>
      </form>
    </main>
  );
}
