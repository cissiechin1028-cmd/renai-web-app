export interface AuthSession {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  email?: string;
}

const SESSION_KEY = "renai.auth.session";

function saveSession(session: AuthSession) {
  window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  return session;
}

function config() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) throw new Error("AUTH_NOT_CONFIGURED");
  return { url, anonKey };
}

export function readSession(): AuthSession | null {
  if (typeof window === "undefined") return null;
  try {
    const session = JSON.parse(window.localStorage.getItem(SESSION_KEY) || "null") as AuthSession | null;
    if (!session || session.expiresAt <= Date.now()) {
      window.localStorage.removeItem(SESSION_KEY);
      return null;
    }
    return session;
  } catch {
    return null;
  }
}

export function captureOAuthSession(): AuthSession | null {
  if (typeof window === "undefined" || !window.location.hash) return readSession();
  const params = new URLSearchParams(window.location.hash.slice(1));
  const accessToken = params.get("access_token");
  if (!accessToken) return readSession();
  const session = {
    accessToken,
    refreshToken: params.get("refresh_token") || "",
    expiresAt: Date.now() + Number(params.get("expires_in") || 3600) * 1000,
  };
  window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  window.history.replaceState({}, document.title, window.location.pathname + window.location.search);
  return session;
}

export async function sendEmailOtp(email: string) {
  const { url, anonKey } = config();
  const response = await fetch(`${url}/auth/v1/otp`, {
    method: "POST",
    headers: { apikey: anonKey, "Content-Type": "application/json" },
    body: JSON.stringify({ email: email.trim(), create_user: true }),
  });
  if (!response.ok) throw new Error(`EMAIL_OTP_FAILED_${response.status}`);
}

export async function verifyEmailOtp(email: string, token: string): Promise<AuthSession> {
  const { url, anonKey } = config();
  const response = await fetch(`${url}/auth/v1/verify`, {
    method: "POST",
    headers: { apikey: anonKey, "Content-Type": "application/json" },
    body: JSON.stringify({ email: email.trim(), token: token.trim(), type: "email" }),
  });
  if (!response.ok) throw new Error(`EMAIL_OTP_VERIFY_FAILED_${response.status}`);
  const data = await response.json() as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    user?: { email?: string };
  };
  if (!data.access_token) throw new Error("EMAIL_OTP_VERIFY_INVALID_RESPONSE");
  return saveSession({
    accessToken: data.access_token,
    refreshToken: data.refresh_token || "",
    expiresAt: Date.now() + Number(data.expires_in || 3600) * 1000,
    email: data.user?.email || email.trim(),
  });
}

export function signInWithGoogle() {
  const { url } = config();
  const redirectTo = encodeURIComponent(`${window.location.origin}/app`);
  window.location.assign(`${url}/auth/v1/authorize?provider=google&redirect_to=${redirectTo}`);
}

export function signOut() {
  window.localStorage.removeItem(SESSION_KEY);
}
