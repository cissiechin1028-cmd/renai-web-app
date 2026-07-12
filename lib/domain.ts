export type AppPlan = "free" | "pro";
export type AnalysisMode = "reply" | "analysis";
export type AnalysisStatus = "queued" | "processing" | "completed" | "failed";

export interface Profile {
  id: string;
  displayName: string | null;
  avatarUrl: string | null;
  plan: AppPlan;
  lifetimeFreeUsage: number;
  proPeriodUsage: number;
  proPeriodStart: string | null;
  proPeriodEnd: string | null;
  role: "user" | "admin";
}

export interface AnalysisRecord {
  id: string;
  userId: string;
  mode: AnalysisMode;
  status: AnalysisStatus;
  title: string;
  result: ReplyResult | ChatAnalysisResult | null;
  createdAt: string;
  completedAt: string | null;
}

export interface ReplyResult {
  kind: "reply";
  naturalness: number;
  recommendedReply: string;
  alternatives: Array<{ tone: string; text: string }>;
  reason: string;
  caution?: string;
  conversationRead: string;
}

export interface ChatAnalysisResult {
  kind: "analysis";
  affection: number;
  intentConsistency: number;
  relationshipTrend: "rising" | "stable" | "falling";
  progressRisk: number;
  summary: string;
  currentPsychology: string;
  evidence: string[];
  keyMoments: Array<{ quote: string; interpretation: string }>;
  actions: string[];
  nextBestMove: string;
}

export const FREE_LIFETIME_LIMIT = 5;
export const PRO_PERIOD_LIMIT = 100;

export function remainingUses(
  profile: Pick<Profile, "plan" | "lifetimeFreeUsage" | "proPeriodUsage">,
) {
  if (profile.plan === "pro") {
    return Math.max(0, PRO_PERIOD_LIMIT - profile.proPeriodUsage);
  }

  return Math.max(0, FREE_LIFETIME_LIMIT - profile.lifetimeFreeUsage);
}
