"use client";

import { ChangeEvent, useCallback, useEffect, useMemo, useState } from "react";
import type { AuthSession } from "../lib/auth-client";
import { captureOAuthSession, sendMagicLink, signInWithGoogle, signOut } from "../lib/auth-client";
import type { ChatAnalysisResult, ReplyResult } from "../lib/domain";
import { createAnalysis, createCheckout, deleteAccount, deleteAnalysis, getAdminSummary, getHistory, getProfile, openBillingPortal } from "../lib/web-api";

type Mode = "reply" | "analysis";
type View = "home" | "history" | "account" | "admin";

type HistoryItem = { id: string; mode: Mode; status: string; title: string; result: ReplyResult | ChatAnalysisResult | null; created_at: string };
type ProfileData = { display_name: string | null; plan: "free" | "pro"; lifetime_free_usage: number; pro_period_usage: number; pro_period_end: string | null; role: "user" | "admin" };

export default function Home() {
  const [view, setView] = useState<View>("home");
  const [mode, setMode] = useState<Mode>("reply");
  const [fileName, setFileName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [stage, setStage] = useState<"idle" | "scanning" | "result">("idle");
  const [query, setQuery] = useState("");
  const [session, setSession] = useState<AuthSession | null>(null);
  const [showAuth, setShowAuth] = useState(false);
  const [email, setEmail] = useState("");
  const [authMessage, setAuthMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [result, setResult] = useState<ReplyResult | ChatAnalysisResult | null>(null);
  const [historyItems, setHistoryItems] = useState<HistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [adminStats, setAdminStats] = useState<{ users: number; proUsers: number; analyses30d: number; conversionRate: number; successRate: number } | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setSession(captureOAuthSession()), 0);
    return () => window.clearTimeout(timer);
  }, []);

  const loadAccountData = useCallback(async (activeSession: AuthSession) => {
    const [historyData, profileData] = await Promise.all([
      getHistory(activeSession.accessToken),
      getProfile(activeSession.accessToken),
    ]);
    setHistoryItems(historyData as HistoryItem[]);
    setProfile(profileData);
  }, []);

  useEffect(() => {
    if (!session || (view !== "history" && view !== "account")) return;
    const timer = window.setTimeout(() => {
      setHistoryLoading(true);
      loadAccountData(session).catch(() => setErrorMessage("データを読み込めませんでした。もう一度ログインしてください。"))
        .finally(() => setHistoryLoading(false));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadAccountData, session, view]);

  useEffect(() => {
    if (!session || view !== "admin" || profile?.role !== "admin") return;
    const timer = window.setTimeout(() => getAdminSummary(session.accessToken).then(setAdminStats).catch(() => setErrorMessage("管理データを読み込めませんでした。")), 0);
    return () => window.clearTimeout(timer);
  }, [profile?.role, session, view]);

  const history = useMemo(() => historyItems.filter((item) => {
    const modeName = item.mode === "reply" ? "返信アドバイス" : "チャット分析";
    return item.title.includes(query) || modeName.includes(query);
  }), [historyItems, query]);

  const usage = profile?.plan === "pro"
    ? { used: profile.pro_period_usage, limit: 100, label: `Pro 残り${Math.max(0, 100 - profile.pro_period_usage)}回` }
    : { used: profile?.lifetime_free_usage || 0, limit: 5, label: `体験 残り${Math.max(0, 5 - (profile?.lifetime_free_usage || 0))}回` };

  function selectFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { setErrorMessage("画像は10MB以下にしてください。"); return; }
    setFile(file);
    setFileName(file.name);
    setErrorMessage("");
    setStage("idle");
  }

  async function startAnalysis() {
    if (!file) return;
    if (!session) { setShowAuth(true); return; }
    setStage("scanning");
    setErrorMessage("");
    try {
      const analysis = await createAnalysis(file, mode, session.accessToken);
      setResult(analysis.result);
      setStage("result");
      loadAccountData(session).catch(() => undefined);
    } catch (error) {
      const code = error instanceof Error ? error.message : "REQUEST_FAILED";
      setErrorMessage(code === "CREDIT_LIMIT_REACHED" ? "利用可能な回数がありません。Proプランをご確認ください。" : "分析に失敗しました。時間をおいてもう一度お試しください。回数は消費されません。");
      setStage("idle");
    }
  }

  async function requestMagicLink() {
    setAuthMessage("");
    try { await sendMagicLink(email); setAuthMessage("ログイン用リンクをメールに送りました。"); }
    catch { setAuthMessage("現在ログイン設定を準備中です。設定完了後に利用できます。"); }
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <button className="brand" onClick={() => setView("home")} aria-label="RenAI ホーム">
          <span className="brand-mark">R</span><span>RenAI</span>
        </button>
        <nav className="desktop-nav" aria-label="メインナビゲーション">
          <button className={view === "home" ? "active" : ""} onClick={() => setView("home")}>分析する</button>
          <button className={view === "history" ? "active" : ""} onClick={() => setView("history")}>履歴</button>
          <button className={view === "account" ? "active" : ""} onClick={() => setView("account")}>アカウント</button>
        </nav>
        <div className="top-actions">{session && <span className="usage-pill">{usage.label}</span>}{session ? <button className="avatar" onClick={() => setView("account")}>{(profile?.display_name || "R").slice(0,1).toUpperCase()}</button> : <button className="login-button" onClick={() => setShowAuth(true)}>ログイン</button>}</div>
      </header>

      {view === "home" && <section className="workspace">
        <div className="intro">
          <span className="eyebrow">LINEのスクショから、次の一言が見つかる</span>
          <h1>迷った返信も、<br /><em>見えない本音</em>も。</h1>
          <p>相談したい機能を選び、LINEのチャット画面をアップロードしてください。画像は分析後に保存しません。</p>
        </div>

        <div className="mode-grid" role="tablist" aria-label="機能を選択">
          <button className={`mode-card reply ${mode === "reply" ? "selected" : ""}`} onClick={() => { setMode("reply"); setStage("idle"); }}>
            <span className="mode-number">01</span><span className="mode-icon">↗</span>
            <strong>返信アドバイス</strong><small>いま届いているメッセージに、自然であなたらしい返信を提案します。</small>
            <b>返信を考える →</b>
          </button>
          <button className={`mode-card analysis ${mode === "analysis" ? "selected" : ""}`} onClick={() => { setMode("analysis"); setStage("idle"); }}>
            <span className="mode-number">02</span><span className="mode-icon">⌁</span>
            <strong>チャット分析</strong><small>会話全体から相手の温度感、本音、関係の変化を読み解きます。</small>
            <b>関係を分析する →</b>
          </button>
        </div>

        <section className="upload-panel">
          <div className="panel-heading"><div><span className="step">STEP 1</span><h2>{mode === "reply" ? "返信したいチャットを追加" : "分析したいチャットを追加"}</h2></div><span className="safe">画像は保存されません</span></div>
          {stage === "idle" && <label className={`dropzone ${fileName ? "has-file" : ""}`}>
            <input type="file" accept="image/png,image/jpeg,image/webp" onChange={selectFile} />
            <span className="upload-icon">＋</span>
            <strong>{fileName || "LINEスクリーンショットを選択"}</strong>
            <small>{fileName ? "別の画像に変更できます" : "PNG・JPG・WEBP / 最大10MB"}</small>
          </label>}
          {stage === "scanning" && <div className="scanner"><div className="scan-phone"><div className="scan-line" /><span>会話を読み取っています…</span></div><p>相手の言葉、文脈、会話のテンポを分析中</p></div>}
          {stage === "result" && result && <Result result={result} onReset={() => { setFile(null); setFileName(""); setResult(null); setStage("idle"); }} />}
          {errorMessage && <p className="form-error">{errorMessage}</p>}
          {stage === "idle" && <button className="primary-action" disabled={!fileName} onClick={startAnalysis}>{mode === "reply" ? "返信案を作成する" : "チャットを分析する"}</button>}
        </section>
      </section>}

      {view === "history" && <section className="page"><PageTitle kicker="MY HISTORY" title="分析履歴" description="過去の返信案と分析結果をいつでも確認できます。" />{!session ? <EmptyState title="ログインが必要です" action="ログイン" onAction={() => setShowAuth(true)} /> : <><div className="toolbar"><input placeholder="履歴を検索" value={query} onChange={(e) => setQuery(e.target.value)} /><button>すべて</button><button>返信</button><button>分析</button></div>{historyLoading ? <p className="loading-text">履歴を読み込んでいます…</p> : history.length === 0 ? <EmptyState title="まだ分析履歴がありません" action="最初の分析をする" onAction={() => setView("home")} /> : <div className="history-list">{history.map((item) => { const score = item.result?.kind === "reply" ? `自然さ ${item.result.naturalness}` : item.result?.kind === "analysis" ? `好感度 ${item.result.affection}` : item.status; return <article key={item.id}><span className="history-icon">{item.mode === "reply" ? "↗" : "⌁"}</span><div><small>{item.mode === "reply" ? "返信アドバイス" : "チャット分析"}</small><h3>{item.title}</h3><p>{new Intl.DateTimeFormat("ja-JP", { dateStyle: "medium", timeStyle: "short" }).format(new Date(item.created_at))}</p></div><strong>{score}</strong><button aria-label="削除" onClick={async () => { if (!session || !window.confirm("この履歴を削除しますか？")) return; await deleteAnalysis(item.id, session.accessToken); setHistoryItems((items) => items.filter((entry) => entry.id !== item.id)); }}>×</button></article>; })}</div>}</>}</section>}

      {view === "account" && <section className="page"><PageTitle kicker="ACCOUNT" title="アカウント" description="プロフィール、利用状況、プランを管理します。" />{!session ? <EmptyState title="ログインが必要です" action="ログイン" onAction={() => setShowAuth(true)} /> : <div className="account-grid"><article className="profile-card"><span className="large-avatar">{(profile?.display_name || "R").slice(0,1).toUpperCase()}</span><div><h3>{profile?.display_name || "RenAIユーザー"}</h3><p>ログイン中</p></div><button onClick={() => { signOut(); setSession(null); setProfile(null); setHistoryItems([]); setView("home"); }}>ログアウト</button></article><article className="plan-card"><span>現在のプラン</span><h3>{profile?.plan === "pro" ? "Pro" : "Free"}</h3><div className="meter"><i style={{width: `${Math.min(100, usage.used / usage.limit * 100)}%`}} /></div><p>{usage.used} / {usage.limit} 回使用（残り{Math.max(0, usage.limit - usage.used)}回）</p><small>{profile?.plan === "pro" ? `契約期間ごとに100回利用できます。${profile.pro_period_end ? ` 次回更新：${new Intl.DateTimeFormat("ja-JP").format(new Date(profile.pro_period_end))}` : ""}` : "無料体験は登録時の5回のみで、毎月の補充はありません。"}</small>{profile?.plan !== "pro" && <button className="upgrade" onClick={async () => { const url = await createCheckout(session.accessToken); window.location.assign(url); }}>Proにアップグレード　¥980/月</button>}</article><article className="settings-card"><h3>設定</h3><button>通知設定 <span>›</span></button><button onClick={async () => { const url = await openBillingPortal(session.accessToken); window.location.assign(url); }}>お支払い・請求 <span>›</span></button><button>プライバシー <span>›</span></button><button className="danger" onClick={async () => { if (!window.confirm("アカウントと全履歴を完全に削除しますか？この操作は元に戻せません。")) return; await deleteAccount(session.accessToken); signOut(); setSession(null); setView("home"); }}>アカウントを削除 <span>›</span></button></article></div>}</section>}

      {view === "admin" && <section className="page"><PageTitle kicker="ADMIN" title="運営ダッシュボード" description="利用状況、売上、分析処理の状態を確認します。" />{profile?.role !== "admin" ? <EmptyState title="管理者だけが閲覧できます" action="ホームへ戻る" onAction={() => setView("home")} /> : <><div className="stats"><Stat label="登録ユーザー" value={String(adminStats?.users ?? "—")} delta="累計"/><Stat label="Proユーザー" value={String(adminStats?.proUsers ?? "—")} delta="現在"/><Stat label="30日間の分析" value={String(adminStats?.analyses30d ?? "—")} delta="直近30日"/><Stat label="Pro転換率" value={adminStats ? `${adminStats.conversionRate}%` : "—"} delta="現在"/><Stat label="処理成功率" value={adminStats ? `${adminStats.successRate}%` : "—"} delta="直近30日"/></div></>}</section>}

      <nav className="mobile-nav"><button onClick={() => setView("home")}>⌂<small>分析</small></button><button onClick={() => setView("history")}>◷<small>履歴</small></button><button onClick={() => setView("account")}>○<small>アカウント</small></button></nav>
      {profile?.role === "admin" && <button className="admin-link" onClick={() => setView("admin")}>運営画面</button>}
      {showAuth && <div className="modal-backdrop" onMouseDown={() => setShowAuth(false)}><section className="auth-modal" onMouseDown={(event) => event.stopPropagation()}><button className="modal-close" onClick={() => setShowAuth(false)}>×</button><span className="brand-mark">R</span><h2>RenAIをはじめる</h2><p>登録すると5回の無料体験が利用できます。</p><button className="google-button" onClick={signInWithGoogle}>Googleで続ける</button><div className="divider"><span>または</span></div><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="メールアドレス"/><button className="primary-action" disabled={!email.includes("@") } onClick={requestMagicLink}>メールでログイン</button>{authMessage && <p className="auth-message">{authMessage}</p>}<small>続行すると利用規約とプライバシーポリシーに同意したものとみなされます。</small></section></div>}
    </main>
  );
}

function Result({ result, onReset }: { result: ReplyResult | ChatAnalysisResult; onReset: () => void }) {
  if (result.kind === "reply") return <div className="result"><div className="result-head"><span>AI 返信アドバイス</span><b>自然さ {result.naturalness}</b></div><h3>おすすめの返信</h3><blockquote>{result.recommendedReply}</blockquote><div className="tone-row">{result.alternatives.map((item) => <button key={item.tone} title={item.text}>{item.tone}</button>)}</div><p className="reason">{result.reason}</p><div className="result-actions"><button onClick={() => navigator.clipboard.writeText(result.recommendedReply)}>コピー</button><button onClick={onReset}>別の画像を分析</button></div></div>;
  const trend = result.relationshipTrend === "rising" ? "上昇中" : result.relationshipTrend === "falling" ? "下降中" : "安定";
  return <div className="result"><div className="result-head"><span>AI チャット分析</span><b>分析完了</b></div><div className="score-grid"><Score label="好感度" value={`${result.affection}%`} color="#ff6cae"/><Score label="本音一致度" value={`${result.intentConsistency}%`} color="#8e68ff"/><Score label="関係の進展" value={trend} color="#3fb9a8"/><Score label="進展リスク" value={`${result.progressRisk}%`} color="#ff9b46"/></div><h3>この会話から見えること</h3><p className="reason">{result.summary}</p><div className="result-actions"><button onClick={onReset}>別の画像を分析</button></div></div>;
}

function Score({ label, value, color }: { label: string; value: string; color: string }) { return <div className="score"><span>{label}</span><strong style={{color}}>{value}</strong><i><b style={{width: typeof value === "string" && value.includes("%") ? value : "76%", background: color}} /></i></div>; }
function PageTitle({ kicker, title, description }: { kicker: string; title: string; description: string }) { return <div className="page-title"><span>{kicker}</span><h1>{title}</h1><p>{description}</p></div>; }
function Stat({ label, value, delta }: { label: string; value: string; delta: string }) { return <article className="stat"><span>{label}</span><strong>{value}</strong><small>{delta} 前月比</small></article>; }
function EmptyState({ title, action, onAction }: { title: string; action: string; onAction: () => void }) { return <div className="empty-state"><span>R</span><h3>{title}</h3><button onClick={onAction}>{action}</button></div>; }
