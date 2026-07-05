"use client";

import { useEffect, useState } from "react";
import {
  api,
  Observation,
  Review,
  WeeklyPlan,
  WeeklyPlanDay,
  WeeklyStructured,
} from "@/lib/api";
import { DomainBadge } from "@/app/components/badge";
import { Button, Card, EmptyState, ErrorBanner, SectionLabel, SkeletonCard } from "@/app/components/ui";
import { Md } from "@/app/components/markdown";
import { humanDate } from "@/lib/format";

/** Chip editor for a day's chores (replaces comma-string parsing). */
function ChoreChips({
  chores,
  disabled,
  onChange,
}: {
  chores: string[];
  disabled: boolean;
  onChange: (chores: string[]) => void;
}) {
  const [draft, setDraft] = useState("");

  function add() {
    const c = draft.trim();
    if (!c) return;
    onChange([...chores, c]);
    setDraft("");
  }

  return (
    <div className="flex flex-wrap items-center gap-1">
      {chores.map((c, i) => (
        <span
          key={`${c}-${i}`}
          className="inline-flex items-center gap-1 rounded-full bg-stone-100 px-2 py-0.5 text-xs text-stone-600"
        >
          {c}
          {!disabled && (
            <button
              onClick={() => onChange(chores.filter((_, j) => j !== i))}
              className="text-stone-400 hover:text-stone-600"
              aria-label={`Remove ${c}`}
            >
              ×
            </button>
          )}
        </span>
      ))}
      {!disabled && (
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          onBlur={add}
          placeholder={chores.length === 0 ? "add chore…" : "+"}
          className="w-20 min-w-0 flex-1 border-none bg-transparent px-1 py-0.5 text-xs focus:outline-none"
        />
      )}
    </div>
  );
}

export default function WeekPage() {
  const [plan, setPlan] = useState<WeeklyPlan | null>(null);
  const [draft, setDraft] = useState<WeeklyStructured | null>(null);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmMsg, setConfirmMsg] = useState<string | null>(null);

  // Weekly review panel
  const [questions, setQuestions] = useState<{ week_start: string; questions: string[] } | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [review, setReview] = useState<Review | null>(null);
  const [proposed, setProposed] = useState<Observation[]>([]);
  const [submitting, setSubmitting] = useState(false);

  function groceryKey(weekStart: string) {
    return `lifeos_grocery_${weekStart}`;
  }

  function applyPlan(p: WeeklyPlan) {
    setPlan(p);
    setDraft(structuredClone(p.structured));
    try {
      const saved = window.localStorage.getItem(groceryKey(p.structured.week_start));
      setChecked(saved ? JSON.parse(saved) : {});
    } catch {
      setChecked({});
    }
  }

  useEffect(() => {
    api
      .currentWeeklyPlan()
      .then(applyPlan)
      .catch(() => {})
      .finally(() => setLoaded(true));
    api.reviewQuestions().then(setQuestions).catch(() => {});
  }, []);

  function toggleGrocery(key: string) {
    setChecked((c) => {
      const next = { ...c, [key]: !c[key] };
      if (draft) {
        try {
          window.localStorage.setItem(groceryKey(draft.week_start), JSON.stringify(next));
        } catch {
          /* storage full/blocked — checks stay in-memory */
        }
      }
      return next;
    });
  }

  async function generate() {
    setLoading(true);
    setError(null);
    setConfirmMsg(null);
    try {
      applyPlan(await api.generateWeeklyPlan());
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  function editDay(idx: number, patch: Partial<WeeklyPlanDay>) {
    if (!draft) return;
    const days = draft.days.map((d, i) => (i === idx ? { ...d, ...patch } : d));
    setDraft({ ...draft, days });
  }

  async function confirm() {
    if (!plan || !draft) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.confirmWeeklyPlan(plan.id, draft);
      setConfirmMsg(`Confirmed — created ${res.tasks_created} tasks.`);
      setPlan({ ...plan, status: res.status });
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  async function copyGrocery() {
    if (!draft) return;
    const text = draft.grocery_list
      .map((g) => `${g.section}\n` + g.items.map((i) => `  - ${i}`).join("\n"))
      .join("\n\n");
    await navigator.clipboard.writeText(text);
    setConfirmMsg("Grocery list copied.");
  }

  async function submitReview() {
    if (!questions || submitting) return;
    setSubmitting(true);
    try {
      const r = await api.submitReviewAnswers(questions.week_start, answers);
      setReview(r);
      setProposed(await api.observations("proposed"));
    } catch (e) {
      setError(String(e));
    } finally {
      setSubmitting(false);
    }
  }

  async function decide(id: string, accept: boolean) {
    try {
      accept ? await api.acceptObservation(id) : await api.rejectObservation(id);
      setProposed((p) => p.filter((o) => o.id !== id));
    } catch (e) {
      setError(String(e));
    }
  }

  const confirmed = plan?.status === "confirmed";

  return (
    <main className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Week</h1>
        <div className="flex items-center gap-2">
          {plan && !confirmed && (
            <Button variant="secondary" onClick={confirm} disabled={loading}>
              Confirm → create tasks
            </Button>
          )}
          <Button onClick={generate} disabled={loading}>
            {loading ? "Working…" : plan ? "Regenerate plan" : "Generate plan"}
          </Button>
        </div>
      </div>

      <ErrorBanner message={error} onDismiss={() => setError(null)} />
      {confirmMsg && <p className="text-sm font-medium text-accent">{confirmMsg}</p>}

      {!loaded && <SkeletonCard lines={6} />}

      {loaded && !plan && (
        <EmptyState
          title="No weekly plan yet"
          hint="Meals, health, home, family, and business agents each contribute; you confirm."
          action={
            <Button onClick={generate} disabled={loading}>
              {loading ? "Working…" : "Generate plan"}
            </Button>
          }
        />
      )}

      {plan && draft && (
        <>
          <section>
            <div className="mb-3 flex items-center gap-2">
              <SectionLabel>Week of {humanDate(draft.week_start)}</SectionLabel>
              <span
                className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                  confirmed ? "bg-accent/10 text-accent" : "bg-amber-50 text-amber-700"
                }`}
              >
                {plan.status}
              </span>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {draft.days.map((d, i) => (
                <Card key={d.date} className="p-4">
                  <div className="mb-2 flex items-baseline justify-between">
                    <span className="text-sm font-semibold">{d.day}</span>
                    <span className="text-xs text-stone-400">{humanDate(d.date)}</span>
                  </div>
                  <div className="space-y-2.5 text-sm">
                    <label className="block">
                      <span className="text-[11px] font-medium uppercase tracking-wide text-amber-600/70">
                        Dinner
                      </span>
                      <input
                        value={d.dinner ?? ""}
                        disabled={confirmed}
                        onChange={(e) => editDay(i, { dinner: e.target.value })}
                        className="mt-0.5 w-full rounded border border-transparent bg-stone-50 px-2 py-1 text-sm hover:border-stone-200 focus:border-accent focus:bg-white focus:outline-none disabled:bg-transparent disabled:px-0"
                      />
                      {d.dinner_prep && !confirmed && (
                        <span className="mt-0.5 block text-[11px] text-stone-400">{d.dinner_prep}</span>
                      )}
                    </label>
                    <label className="block">
                      <span className="text-[11px] font-medium uppercase tracking-wide text-emerald-600/70">
                        Workout
                      </span>
                      <input
                        value={d.workout ?? ""}
                        disabled={confirmed}
                        onChange={(e) => editDay(i, { workout: e.target.value })}
                        className="mt-0.5 w-full rounded border border-transparent bg-stone-50 px-2 py-1 text-sm hover:border-stone-200 focus:border-accent focus:bg-white focus:outline-none disabled:bg-transparent disabled:px-0"
                      />
                    </label>
                    <div>
                      <span className="text-[11px] font-medium uppercase tracking-wide text-sky-600/70">
                        Chores
                      </span>
                      <div className="mt-1">
                        <ChoreChips
                          chores={d.chores}
                          disabled={confirmed}
                          onChange={(chores) => editDay(i, { chores })}
                        />
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </section>

          <section>
            <div className="mb-3 flex items-center justify-between">
              <SectionLabel>Grocery list</SectionLabel>
              <button onClick={copyGrocery} className="text-xs text-accent hover:underline">
                Copy as text
              </button>
            </div>
            <Card>
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {draft.grocery_list.map((g) => (
                  <div key={g.section}>
                    <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-stone-400">
                      {g.section}
                    </h3>
                    <ul className="space-y-1.5">
                      {g.items.map((item) => {
                        const key = `${g.section}:${item}`;
                        return (
                          <li key={key} className="flex items-center gap-2 text-sm">
                            <input
                              type="checkbox"
                              checked={!!checked[key]}
                              onChange={() => toggleGrocery(key)}
                              className="h-4 w-4 accent-[#4b6b5a]"
                            />
                            <span className={checked[key] ? "text-stone-300 line-through" : ""}>
                              {item}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))}
              </div>
            </Card>
          </section>

          {draft.prep_notes.length > 0 && (
            <section>
              <SectionLabel>Prep & notes</SectionLabel>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-stone-600">
                {draft.prep_notes.map((n) => (
                  <li key={n}>{n}</li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}

      <Card>
        <div className="mb-4 flex items-center justify-between">
          <SectionLabel>Weekly review</SectionLabel>
          {questions && <span className="text-xs text-stone-400">week of {humanDate(questions.week_start)}</span>}
        </div>

        {questions && !review && (
          <div className="space-y-4">
            {questions.questions.map((q) => (
              <label key={q} className="block text-sm">
                <span className="font-medium text-stone-600">{q}</span>
                <textarea
                  value={answers[q] ?? ""}
                  onChange={(e) => setAnswers((a) => ({ ...a, [q]: e.target.value }))}
                  rows={2}
                  className="mt-1 w-full resize-y rounded-lg border border-stone-200 px-3 py-2 text-sm focus:border-accent focus:outline-none"
                />
              </label>
            ))}
            <Button onClick={submitReview} disabled={submitting}>
              {submitting ? "Reflecting…" : "Submit review"}
            </Button>
          </div>
        )}

        {review && (
          <div className="space-y-5">
            <div className="rounded-lg bg-base p-4">
              <Md>{review.insights}</Md>
            </div>
            {proposed.length > 0 && (
              <div>
                <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-stone-400">
                  Proposed observations — accept what rings true
                </h3>
                <ul className="space-y-2">
                  {proposed.map((o) => (
                    <li
                      key={o.id}
                      className="flex items-center justify-between gap-3 rounded-lg border border-stone-200 bg-white p-3 text-sm"
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <DomainBadge domain={o.domain} />
                        <span className="min-w-0">{o.content}</span>
                      </span>
                      <span className="flex shrink-0 gap-1">
                        <Button variant="secondary" onClick={() => decide(o.id, true)}>
                          Accept
                        </Button>
                        <Button variant="ghost" onClick={() => decide(o.id, false)}>
                          Reject
                        </Button>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </Card>
    </main>
  );
}
