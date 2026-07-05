"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { api, Briefing, chatStream, Task } from "@/lib/api";
import { DomainBadge } from "@/app/components/badge";
import { Button, Card, EmptyState, ErrorBanner, SectionLabel, SkeletonCard } from "@/app/components/ui";
import { Md } from "@/app/components/markdown";
import { PlusIcon, SparkIcon } from "@/app/components/icons";
import { daysFromToday, humanDue, timeAgo } from "@/lib/format";

const DOMAINS = ["family", "health", "meals", "home", "faith", "finance", "business", "general"];
const UNDO_MS = 5000;

type Bucket = "Overdue" | "Today" | "Upcoming" | "Someday";

function bucketOf(t: Task): Bucket {
  const date = t.due_date ?? t.scheduled_for;
  if (!date) return "Someday";
  const d = daysFromToday(date);
  if (d < 0) return "Overdue";
  if (d === 0) return "Today";
  return "Upcoming";
}

const DUE_TONES: Record<string, string> = {
  overdue: "text-amber-700",
  today: "text-accent",
  soon: "text-stone-500",
  later: "text-stone-400",
};

export default function TodayPage() {
  const [briefing, setBriefing] = useState<Briefing | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Inline add-task
  const [newTitle, setNewTitle] = useState("");
  const [newDomain, setNewDomain] = useState("general");
  const [adding, setAdding] = useState(false);

  // Delayed complete with undo
  const [pendingDone, setPendingDone] = useState<Task[]>([]);
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  // What-now modal
  const [chatOpen, setChatOpen] = useState(false);
  const [answer, setAnswer] = useState("");
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const sessionId = useMemo(() => Math.random().toString(36).slice(2), []);

  useEffect(() => {
    Promise.allSettled([
      api.todayBriefing().then(setBriefing),
      api.tasks("open").then(setTasks),
    ]).then(() => setLoaded(true));
    const t = timers.current;
    return () => Object.values(t).forEach(clearTimeout);
  }, []);

  async function regenerate() {
    setGenerating(true);
    setError(null);
    try {
      setBriefing(await api.generateBriefing());
    } catch (e) {
      setError(String(e));
    } finally {
      setGenerating(false);
    }
  }

  function complete(task: Task) {
    // Optimistic: pull from the list, hold in an undo toast, commit after 5s.
    setTasks((t) => t.filter((x) => x.id !== task.id));
    setPendingDone((p) => [...p, task]);
    timers.current[task.id] = setTimeout(async () => {
      delete timers.current[task.id];
      setPendingDone((p) => p.filter((x) => x.id !== task.id));
      try {
        await api.completeTask(task.id);
      } catch (e) {
        setError(String(e));
        setTasks((t) => [...t, task]);
      }
    }, UNDO_MS);
  }

  function undo(task: Task) {
    clearTimeout(timers.current[task.id]);
    delete timers.current[task.id];
    setPendingDone((p) => p.filter((x) => x.id !== task.id));
    setTasks((t) => [...t, task]);
  }

  async function addTask(e: React.FormEvent) {
    e.preventDefault();
    const title = newTitle.trim();
    if (!title || adding) return;
    setAdding(true);
    setError(null);
    try {
      const t = await api.createTask({ title, domain: newDomain });
      setTasks((cur) => [...cur, t]);
      setNewTitle("");
    } catch (err) {
      setError(String(err));
    } finally {
      setAdding(false);
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

  const buckets = useMemo(() => {
    const by: Record<Bucket, Task[]> = { Overdue: [], Today: [], Upcoming: [], Someday: [] };
    for (const t of tasks) by[bucketOf(t)].push(t);
    for (const list of Object.values(by))
      list.sort((a, b) => (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999") || a.priority - b.priority);
    return by;
  }, [tasks]);

  return (
    <main className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Today</h1>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => ask("what should I do right now")}>
            <span className="flex items-center gap-1.5">
              <SparkIcon className="h-4 w-4" /> What now?
            </span>
          </Button>
          {!briefing && (
            <Button onClick={regenerate} disabled={generating}>
              {generating ? "Generating…" : "Generate briefing"}
            </Button>
          )}
        </div>
      </div>

      <ErrorBanner message={error} onDismiss={() => setError(null)} />

      {!loaded ? (
        <SkeletonCard lines={5} />
      ) : briefing ? (
        <Card className="p-6 md:p-8">
          <div className="mb-4 flex items-center justify-between">
            <SectionLabel>Morning briefing</SectionLabel>
            <div className="flex items-center gap-3 text-xs text-stone-400">
              <span>{timeAgo(briefing.created_at)}</span>
              <button
                onClick={regenerate}
                disabled={generating}
                className="text-stone-400 underline underline-offset-2 hover:text-accent disabled:opacity-50"
              >
                {generating ? "regenerating…" : "regenerate"}
              </button>
            </div>
          </div>
          <Md>{briefing.content}</Md>
        </Card>
      ) : (
        <EmptyState
          title="No briefing yet today"
          hint="Your chief of staff pulls weather, calendar, and tasks into one calm summary."
          action={
            <Button onClick={regenerate} disabled={generating}>
              {generating ? "Generating…" : "Generate briefing"}
            </Button>
          }
        />
      )}

      <section className="space-y-5">
        <div className="flex items-center justify-between">
          <SectionLabel>Tasks</SectionLabel>
          <span className="text-xs text-stone-400">{tasks.length} open</span>
        </div>

        <form onSubmit={addTask} className="flex gap-2">
          <input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Add a task…"
            className="min-w-0 flex-1 rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm focus:border-accent focus:outline-none"
          />
          <select
            value={newDomain}
            onChange={(e) => setNewDomain(e.target.value)}
            className="rounded-lg border border-stone-200 bg-white px-2 py-2 text-sm text-stone-600 focus:border-accent focus:outline-none"
          >
            {DOMAINS.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
          <Button type="submit" disabled={adding || !newTitle.trim()} aria-label="Add task">
            <PlusIcon className="h-4 w-4" />
          </Button>
        </form>

        {loaded && tasks.length === 0 && pendingDone.length === 0 && (
          <EmptyState title="All clear" hint="No open tasks — enjoy the quiet." />
        )}

        {(["Overdue", "Today", "Upcoming", "Someday"] as Bucket[]).map((bucket) => {
          const list = buckets[bucket];
          if (list.length === 0) return null;
          return (
            <div key={bucket}>
              <h3
                className={`mb-2 text-xs font-semibold uppercase tracking-wider ${
                  bucket === "Overdue" ? "text-amber-600" : "text-stone-400"
                }`}
              >
                {bucket}
              </h3>
              <ul className="space-y-1.5">
                {list.map((t) => {
                  const date = t.due_date ?? t.scheduled_for;
                  const due = date ? humanDue(date) : null;
                  return (
                    <li
                      key={t.id}
                      className="flex items-center gap-3 rounded-lg border border-stone-200/70 bg-white px-3 py-2.5"
                    >
                      <input
                        type="checkbox"
                        onChange={() => complete(t)}
                        className="h-4 w-4 shrink-0 accent-[#4b6b5a]"
                        aria-label={`Complete ${t.title}`}
                      />
                      <span className="min-w-0 flex-1 truncate text-sm font-medium">{t.title}</span>
                      {due && (
                        <span className={`shrink-0 text-xs ${DUE_TONES[due.tone]}`}>{due.label}</span>
                      )}
                      <DomainBadge domain={t.domain} />
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </section>

      {/* Undo toasts */}
      {pendingDone.length > 0 && (
        <div className="fixed bottom-20 left-1/2 z-30 flex -translate-x-1/2 flex-col gap-2 md:bottom-8">
          {pendingDone.map((t) => (
            <div
              key={t.id}
              className="flex items-center gap-3 rounded-full bg-ink px-4 py-2 text-sm text-white shadow-lg"
            >
              <span className="max-w-[240px] truncate">Completed “{t.title}”</span>
              <button onClick={() => undo(t)} className="font-semibold text-emerald-300 hover:underline">
                Undo
              </button>
            </div>
          ))}
        </div>
      )}

      {/* What-now modal */}
      {chatOpen && (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/20 p-4 sm:items-center">
          <div className="w-full max-w-lg rounded-xl bg-white p-5 shadow-xl">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="flex items-center gap-1.5 text-sm font-semibold text-accent">
                <SparkIcon className="h-4 w-4" /> Chief of Staff
              </h3>
              <button onClick={() => setChatOpen(false)} className="text-stone-400 hover:text-ink">
                ✕
              </button>
            </div>
            <div className="max-h-[50vh] min-h-[80px] overflow-y-auto rounded-lg bg-base p-4">
              {answer ? (
                <Md>{answer}</Md>
              ) : (
                <p className="text-sm text-stone-400">{streaming ? "Thinking…" : "Ask a question."}</p>
              )}
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
                className="flex-1 rounded-lg border border-stone-200 px-3 py-2 text-sm focus:border-accent focus:outline-none"
              />
              <Button type="submit" disabled={streaming}>
                Send
              </Button>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
