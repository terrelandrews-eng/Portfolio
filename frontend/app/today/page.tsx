"use client";

import { useEffect, useMemo, useState } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { api, Briefing, chatStream, Task } from "@/lib/api";

const mdComponents = {
  h1: (p: any) => <h1 className="mb-2 text-xl font-semibold text-accent" {...p} />,
  h2: (p: any) => <h2 className="mb-1 mt-4 text-sm font-semibold uppercase tracking-wide text-gray-500" {...p} />,
  p: (p: any) => <p className="mb-2 leading-relaxed" {...p} />,
  ul: (p: any) => <ul className="mb-2 list-disc space-y-1 pl-5" {...p} />,
  ol: (p: any) => <ol className="mb-2 list-decimal space-y-1 pl-5" {...p} />,
  strong: (p: any) => <strong className="font-semibold text-ink" {...p} />,
};

export default function TodayPage() {
  const [briefing, setBriefing] = useState<Briefing | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [chatOpen, setChatOpen] = useState(false);
  const [answer, setAnswer] = useState("");
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const sessionId = useMemo(() => Math.random().toString(36).slice(2), []);

  async function loadBriefing() {
    try {
      setBriefing(await api.todayBriefing());
    } catch {
      setBriefing(null); // 404 — none yet
    }
  }

  async function loadTasks() {
    try {
      setTasks(await api.tasks("open"));
    } catch (e) {
      setError(String(e));
    }
  }

  useEffect(() => {
    loadBriefing();
    loadTasks();
  }, []);

  async function regenerate() {
    setLoading(true);
    setError(null);
    try {
      setBriefing(await api.generateBriefing());
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  async function complete(id: string) {
    setTasks((t) => t.filter((x) => x.id !== id)); // optimistic
    try {
      await api.completeTask(id);
    } catch (e) {
      setError(String(e));
      loadTasks();
    }
  }

  async function ask(message: string) {
    setChatOpen(true);
    setAnswer("");
    setStreaming(true);
    try {
      await chatStream(sessionId, message, (t) => setAnswer((a) => a + t));
    } catch (e) {
      setAnswer(String(e));
    } finally {
      setStreaming(false);
    }
  }

  return (
    <main className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Today</h1>
        <div className="flex gap-2">
          <button
            onClick={() => ask("what should I do right now")}
            className="rounded border border-accent px-3 py-1.5 text-sm text-accent"
          >
            What should I do right now?
          </button>
          <button
            onClick={regenerate}
            disabled={loading}
            className="rounded bg-accent px-3 py-1.5 text-sm text-white"
          >
            {loading ? "Generating…" : briefing ? "Regenerate" : "Generate briefing"}
          </button>
        </div>
      </div>

      {error && <p className="text-sm text-amber-700">{error}</p>}

      <section className="rounded-lg border border-gray-200 bg-white p-6">
        {briefing ? (
          <div className="text-sm text-ink">
            <Markdown remarkPlugins={[remarkGfm]} components={mdComponents}>
              {briefing.content}
            </Markdown>
          </div>
        ) : (
          <p className="text-sm text-gray-500">
            No briefing yet today. Click <span className="font-medium">Generate briefing</span>.
          </p>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-500">
          Open tasks
        </h2>
        <ul className="space-y-1">
          {tasks.map((t) => (
            <li key={t.id} className="flex items-center gap-2 rounded bg-white/60 px-3 py-2 text-sm">
              <input
                type="checkbox"
                onChange={() => complete(t.id)}
                className="h-4 w-4 accent-[#4b6b5a]"
              />
              <span className="font-medium">{t.title}</span>
              <span className="text-xs text-gray-500">
                {t.domain} · p{t.priority}
                {t.due_date ? ` · due ${t.due_date}` : ""}
              </span>
            </li>
          ))}
          {tasks.length === 0 && <li className="text-sm text-gray-500">No open tasks.</li>}
        </ul>
      </section>

      {chatOpen && (
        <div className="fixed inset-0 z-10 flex items-end justify-center bg-black/20 p-4 sm:items-center">
          <div className="w-full max-w-lg rounded-lg bg-white p-5 shadow-lg">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-accent">Chief of Staff</h3>
              <button onClick={() => setChatOpen(false)} className="text-sm text-gray-400">
                ✕
              </button>
            </div>
            <div className="min-h-[80px] whitespace-pre-wrap rounded bg-base p-3 text-sm">
              {answer || (streaming ? "…" : "Ask a question.")}
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (input.trim()) {
                  ask(input);
                  setInput("");
                }
              }}
              className="mt-3 flex gap-2"
            >
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask the Chief of Staff…"
                className="flex-1 rounded border border-gray-300 px-3 py-2 text-sm"
              />
              <button
                type="submit"
                disabled={streaming}
                className="rounded bg-accent px-3 py-2 text-sm text-white"
              >
                Send
              </button>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
