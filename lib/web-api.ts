import type { AnalysisMode, ChatAnalysisResult, ReplyResult } from "./domain";

const apiUrl = () => process.env.NEXT_PUBLIC_AI_API_URL?.replace(/\/$/, "") || "";

async function apiFetch(path: string, token: string, init?: RequestInit) {
  if (!apiUrl()) throw new Error("API_NOT_CONFIGURED");
  const response = await fetch(`${apiUrl()}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, ...init?.headers },
  });
  const payload = response.status === 204 ? null : await response.json().catch(() => null);
  if (!response.ok) {
    const error = new Error(payload?.error || "REQUEST_FAILED");
    Object.assign(error, { status: response.status, payload });
    throw error;
  }
  return payload;
}

export async function createAnalysis(file: File, mode: AnalysisMode, token: string) {
  const payload = await apiFetch("/api/v1/analyses", token, {
    method: "POST",
    headers: { "Content-Type": file.type, "X-Analysis-Mode": mode },
    body: file,
  });
  return payload.analysis as { id: string; mode: AnalysisMode; result: ReplyResult | ChatAnalysisResult };
}

export async function getHistory(token: string) {
  const payload = await apiFetch("/api/v1/analyses?limit=50", token);
  return payload.analyses as Array<Record<string, unknown>>;
}

export async function getProfile(token: string) {
  const payload = await apiFetch("/api/v1/me", token);
  return payload.profile as {
    id: string;
    display_name: string | null;
    avatar_url: string | null;
    plan: "free" | "pro";
    lifetime_free_usage: number;
    pro_period_usage: number;
    pro_period_end: string | null;
    role: "user" | "admin";
  };
}

export async function deleteAnalysis(id: string, token: string) {
  await apiFetch(`/api/v1/analyses/${encodeURIComponent(id)}`, token, { method: "DELETE" });
}

export async function createCheckout(token: string) {
  const payload = await apiFetch("/api/v1/billing/checkout", token, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
  return payload.url as string;
}

export async function openBillingPortal(token: string) {
  const payload = await apiFetch("/api/v1/billing/portal", token, { method: "POST" });
  return payload.url as string;
}

export async function getAdminSummary(token: string) {
  return apiFetch("/api/v1/admin/summary", token) as Promise<{ users: number; proUsers: number; analyses30d: number; conversionRate: number; successRate: number }>;
}

export async function deleteAccount(token: string) {
  await apiFetch("/api/v1/me", token, { method: "DELETE" });
}
