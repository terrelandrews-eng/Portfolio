// Thin API client. The bearer token is stored in localStorage after a simple
// login on the Settings screen (single-user system, spec §8).

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000/api/v1";

export function getToken(): string {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem("lifeos_token") ?? "";
}

export function setToken(token: string) {
  window.localStorage.setItem("lifeos_token", token);
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getToken()}`,
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status}: ${text}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export interface SearchResult {
  source: string;
  id: string;
  title: string;
  snippet: string;
  score: number;
  domain: string | null;
}

export interface Entity {
  id: string;
  type: string;
  name: string;
  attributes: Record<string, unknown>;
  notes: string | null;
}

export interface Briefing {
  id: string;
  date: string;
  content: string;
  created_at: string;
}

export interface Task {
  id: string;
  title: string;
  domain: string;
  status: string;
  priority: number;
  due_date: string | null;
  scheduled_for: string | null;
}

export interface WeeklyPlanDay {
  day: string;
  date: string;
  dinner: string | null;
  dinner_prep: string | null;
  workout: string | null;
  chores: string[];
}

export interface GroceryGroup {
  section: string;
  items: string[];
}

export interface WeeklyStructured {
  week_start: string;
  days: WeeklyPlanDay[];
  grocery_list: GroceryGroup[];
  prep_notes: string[];
  flags: string[];
  context?: { observations: string[]; contributions: Record<string, string>; missing: string[] };
}

export interface WeeklyPlan {
  id: string;
  week_start: string;
  content: string;
  structured: WeeklyStructured;
  status: string;
  created_at: string;
}

export interface Review {
  id: string;
  week_start: string;
  insights: string;
  proposed_observations: { proposals: Observation[]; proposed: string[]; reinforced: string[] };
  actual: Record<string, unknown>;
}

export interface Observation {
  id: string;
  domain: string;
  kind: string;
  content: string;
  confidence: number;
  evidence_count: number;
  status: string;
}

export interface Proposal {
  id: string;
  kind: string;
  status: string;
  summary: string;
  payload: Record<string, unknown>;
  source: string | null;
  agent: string | null;
  result: Record<string, unknown>;
}

export interface TaskCreatePayload {
  title: string;
  domain: string;
  due_date?: string;
  priority?: number;
}

export interface Healthz {
  status: string;
  db: boolean;
  mock_integrations: boolean;
  embeddings: string;
  llm: string;
  scheduler: { running: boolean; jobs: { id: string; next_run: string | null }[] };
}

export interface AdminCost {
  runs: number;
  tokens_in: number;
  tokens_out: number;
  errors: number;
  by_agent: { agent: string; runs: number; tokens: number }[];
}

export interface FinanceSummary {
  month: string;
  total: number;
  by_category: Record<string, number>;
  transaction_count: number;
}

export const api = {
  search: (q: string) =>
    request<{ query: string; results: SearchResult[] }>(
      `/knowledge/search?q=${encodeURIComponent(q)}`,
    ),
  entities: (type?: string) =>
    request<Entity[]>(`/entities${type ? `?type=${type}` : ""}`),
  getPriorities: () =>
    request<{ id: string; version: number; content: string }>(`/priorities`),
  updatePriorities: (content: string) =>
    request(`/priorities`, { method: "PUT", body: JSON.stringify({ content }) }),
  health: () => request<Healthz>(`/healthz`),
  adminCost: () => request<AdminCost>(`/admin/cost`),

  // Phase 2
  todayBriefing: () => request<Briefing>(`/briefing/today`),
  generateBriefing: () => request<Briefing>(`/briefing/generate`, { method: "POST" }),
  tasks: (status = "open") => request<Task[]>(`/tasks?status=${status}`),
  createTask: (payload: TaskCreatePayload) =>
    request<Task>(`/tasks`, { method: "POST", body: JSON.stringify(payload) }),
  completeTask: (id: string) =>
    request<Task>(`/tasks/${id}/complete`, { method: "POST" }),

  // Phase 3 — weekly rhythm + memory
  currentWeeklyPlan: () => request<WeeklyPlan>(`/weekly-plan/current`),
  generateWeeklyPlan: () =>
    request<WeeklyPlan>(`/weekly-plan/generate`, { method: "POST" }),
  confirmWeeklyPlan: (id: string, structured: WeeklyStructured) =>
    request<{ plan_id: string; status: string; tasks_created: number }>(
      `/weekly-plan/${id}/confirm`,
      { method: "POST", body: JSON.stringify({ structured }) },
    ),
  reviewQuestions: () =>
    request<{ week_start: string; questions: string[] }>(`/review/questions`),
  submitReviewAnswers: (week_start: string, answers: Record<string, string>) =>
    request<Review>(`/review/answers`, {
      method: "POST",
      body: JSON.stringify({ week_start, answers }),
    }),

  observations: (status?: string) =>
    request<Observation[]>(`/observations${status ? `?status=${status}` : ""}`),
  acceptObservation: (id: string) =>
    request<Observation>(`/observations/${id}/accept`, { method: "POST" }),
  rejectObservation: (id: string) =>
    request<Observation>(`/observations/${id}/reject`, { method: "POST" }),
  retireObservation: (id: string) =>
    request<Observation>(`/observations/${id}/retire`, { method: "POST" }),

  // Phase 4 — proposals, capture, finance
  proposals: (status = "pending") => request<Proposal[]>(`/proposals?status=${status}`),
  approveProposal: (id: string) =>
    request<Proposal>(`/proposals/${id}/approve`, { method: "POST" }),
  rejectProposal: (id: string) =>
    request<Proposal>(`/proposals/${id}/reject`, { method: "POST" }),
  capture: (text: string) =>
    request<{ proposals: Proposal[] }>(`/capture`, {
      method: "POST",
      body: JSON.stringify({ text }),
    }),
  financeSummary: (month?: string) =>
    request<FinanceSummary>(`/finance/summary${month ? `?month=${month}` : ""}`),
  financeImport: async (file: File) => {
    const form = new FormData();
    form.append("file", file);
    const res = await fetch(`${API_BASE}/finance/import`, {
      method: "POST",
      headers: { Authorization: `Bearer ${getToken()}` },
      body: form,
    });
    if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
    return res.json() as Promise<{ imported: number; skipped: number; month_summary: FinanceSummary }>;
  },
};

// SSE chat: POST + read the streamed body, parsing `event:`/`data:` frames.
export async function chatStream(
  sessionId: string,
  message: string,
  onToken: (t: string) => void,
  onMeta?: (m: Record<string, unknown>) => void,
  onProposals?: (p: Proposal[]) => void,
): Promise<void> {
  const API_BASE =
    process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000/api/v1";
  const res = await fetch(`${API_BASE}/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getToken()}`,
    },
    body: JSON.stringify({ session_id: sessionId, message }),
  });
  if (!res.body) throw new Error("No response stream");

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const frames = buffer.split("\n\n");
    buffer = frames.pop() ?? "";
    for (const frame of frames) {
      const lines = frame.split("\n");
      const event = lines.find((l) => l.startsWith("event:"))?.slice(6).trim();
      const dataLine = lines.find((l) => l.startsWith("data:"))?.slice(5).trim();
      if (!dataLine) continue;
      const data = JSON.parse(dataLine);
      if (event === "token") onToken(data.t);
      else if (event === "meta") onMeta?.(data);
      else if (event === "proposals") onProposals?.(data.proposals);
    }
  }
}
