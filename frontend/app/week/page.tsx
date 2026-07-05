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

export default function WeekPage() {
  const [plan, setPlan] = useState<WeeklyPlan | null>(null);
  const [draft, setDraft] = useState<WeeklyStructured | null>(null);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmMsg, setConfirmMsg] = useState<string | null>(null);

  // Weekly review panel
  const [questions, setQuestions] = useState<{ week_start: string; questions: string[] } | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [review, setReview] = useState<Review | null>(null);
  const [proposed, setProposed] = useState<Observation[]>([]);

  async function loadPlan() {
    try {
      const p = await api.currentWeeklyPlan();
      setPlan(p);
      setDraft(structuredClone(p.structured));
    } catch {
      setPlan(null);
      setDraft(null);
    }
  }

  useEffect(() => {
    loadPlan();
    api.reviewQuestions().then(setQuestions).catch(() => {});
  }, []);

  async function generate() {
    setLoading(true);
    setError(null);
    setConfirmMsg(null);
    try {
      const p = await api.generateWeeklyPlan();
      setPlan(p);
      setDraft(structuredClone(p.structured));
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

  function groceryText(): string {
    if (!draft) return "";
    return draft.grocery_list
      .map((g) => `${g.section}\n` + g.items.map((i) => `  - ${i}`).join("\n"))
      .join("\n\n");
  }

  async function copyGrocery() {
    await navigator.clipboard.writeText(groceryText());
    setConfirmMsg("Grocery list copied.");
  }

  async function submitReview() {
    if (!questions) return;
    try {
      const r = await api.submitReviewAnswers(questions.week_start, answers);
      setReview(r);
      setProposed(await api.observations("proposed"));
    } catch (e) {
      setError(String(e));
    }
  }

  async function decide(id: string, accept: boolean) {
    accept ? await api.acceptObservation(id) : await api.rejectObservation(id);
    setProposed((p) => p.filter((o) => o.id !== id));
  }

  const confirmed = plan?.status === "confirmed";

  return (
    <main className="space-y-10">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Week</h1>
        <button
          onClick={generate}
          disabled={loading}
          className="rounded bg-accent px-3 py-1.5 text-sm text-white"
        >
          {loading ? "Working…" : plan ? "Regenerate plan" : "Generate plan"}
        </button>
      </div>

      {error && <p className="text-sm text-amber-700">{error}</p>}
      {confirmMsg && <p className="text-sm text-accent">{confirmMsg}</p>}

      {!plan && (
        <p className="text-sm text-gray-500">
          No weekly plan yet. Click <span className="font-medium">Generate plan</span>.
        </p>
      )}

      {plan && draft && (
        <>
          <section>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
                Week of {draft.week_start} ·{" "}
                <span className={confirmed ? "text-accent" : "text-amber-700"}>{plan.status}</span>
              </h2>
              {!confirmed && (
                <button
                  onClick={confirm}
                  disabled={loading}
                  className="rounded border border-accent px-3 py-1.5 text-sm text-accent"
                >
                  Confirm → create tasks
                </button>
              )}
            </div>

            <div className="space-y-2">
              {draft.days.map((d, i) => (
                <div key={d.date} className="rounded border border-gray-200 bg-white p-3 text-sm">
                  <div className="mb-1 font-medium">
                    {d.day} <span className="text-xs text-gray-400">{d.date}</span>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-3">
                    <label className="text-xs text-gray-500">
                      Dinner
                      <input
                        value={d.dinner ?? ""}
                        disabled={confirmed}
                        onChange={(e) => editDay(i, { dinner: e.target.value })}
                        className="mt-0.5 w-full rounded border border-gray-200 px-2 py-1 text-sm text-ink disabled:bg-gray-50"
                      />
                    </label>
                    <label className="text-xs text-gray-500">
                      Workout
                      <input
                        value={d.workout ?? ""}
                        disabled={confirmed}
                        onChange={(e) => editDay(i, { workout: e.target.value })}
                        className="mt-0.5 w-full rounded border border-gray-200 px-2 py-1 text-sm text-ink disabled:bg-gray-50"
                      />
                    </label>
                    <label className="text-xs text-gray-500">
                      Chores
                      <input
                        value={d.chores.join(", ")}
                        disabled={confirmed}
                        onChange={(e) =>
                          editDay(i, {
                            chores: e.target.value.split(",").map((s) => s.trim()).filter(Boolean),
                          })
                        }
                        className="mt-0.5 w-full rounded border border-gray-200 px-2 py-1 text-sm text-ink disabled:bg-gray-50"
                      />
                    </label>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
                Grocery list
              </h2>
              <button onClick={copyGrocery} className="text-xs text-accent hover:underline">
                Copy as text
              </button>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {draft.grocery_list.map((g) => (
                <div key={g.section}>
                  <h3 className="mb-1 text-xs font-medium uppercase tracking-wide text-gray-400">
                    {g.section}
                  </h3>
                  <ul className="space-y-1">
                    {g.items.map((item) => {
                      const key = `${g.section}:${item}`;
                      return (
                        <li key={key} className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={!!checked[key]}
                            onChange={() => setChecked((c) => ({ ...c, [key]: !c[key] }))}
                            className="h-4 w-4 accent-[#4b6b5a]"
                          />
                          <span className={checked[key] ? "text-gray-400 line-through" : ""}>{item}</span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          </section>

          {draft.prep_notes.length > 0 && (
            <section>
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-500">
                Prep & notes
              </h2>
              <ul className="list-disc space-y-1 pl-5 text-sm">
                {draft.prep_notes.map((n) => (
                  <li key={n}>{n}</li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}

      <section className="rounded-lg border border-gray-200 bg-white p-5">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
          Weekly review
        </h2>
        {questions && !review && (
          <div className="space-y-3">
            {questions.questions.map((q) => (
              <label key={q} className="block text-sm">
                <span className="text-gray-600">{q}</span>
                <input
                  value={answers[q] ?? ""}
                  onChange={(e) => setAnswers((a) => ({ ...a, [q]: e.target.value }))}
                  className="mt-0.5 w-full rounded border border-gray-200 px-2 py-1 text-sm"
                />
              </label>
            ))}
            <button
              onClick={submitReview}
              className="rounded bg-accent px-3 py-1.5 text-sm text-white"
            >
              Submit review
            </button>
          </div>
        )}

        {review && (
          <div className="space-y-4">
            <pre className="whitespace-pre-wrap rounded bg-base p-3 text-sm">{review.insights}</pre>
            {proposed.length > 0 && (
              <div>
                <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-400">
                  Proposed observations
                </h3>
                <ul className="space-y-2">
                  {proposed.map((o) => (
                    <li
                      key={o.id}
                      className="flex items-center justify-between gap-3 rounded border border-gray-200 p-2 text-sm"
                    >
                      <span>
                        <span className="text-xs text-gray-400">[{o.domain}] </span>
                        {o.content}
                      </span>
                      <span className="flex shrink-0 gap-2">
                        <button onClick={() => decide(o.id, true)} className="text-xs text-accent hover:underline">
                          Accept
                        </button>
                        <button onClick={() => decide(o.id, false)} className="text-xs text-gray-400 hover:underline">
                          Reject
                        </button>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </section>
    </main>
  );
}
