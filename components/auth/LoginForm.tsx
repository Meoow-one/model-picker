"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";
import SupabaseSetup from "@/components/auth/SupabaseSetup";
import { authErrorMessage, safeNext, userLabel } from "@/lib/account-utils";

type Mode = "login" | "register";

export default function LoginForm() {
  const router = useRouter();
  const { configured, loading, user, signIn, signUp, signOut } = useAuth();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [sentEmail, setSentEmail] = useState<string | null>(null);
  const [next, setNext] = useState("/");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setNext(safeNext(params.get("next")));
    if (params.get("confirmed") === "1") {
      setNotice("邮箱验证已完成，请用同一邮箱登录。");
    }
  }, []);

  function switchMode(nextMode: Mode) {
    setMode(nextMode);
    setError(null);
    setNotice(null);
    setSentEmail(null);
    setConfirm("");
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    setError(null);

    const cleanEmail = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setError("请输入有效的邮箱地址。");
      return;
    }
    if (password.length < 8) {
      setError("密码至少 8 个字符。");
      return;
    }
    if (mode === "register" && password !== confirm) {
      setError("两次输入的密码不一致。");
      return;
    }

    setBusy(true);
    try {
      if (mode === "login") {
        await signIn(cleanEmail, password);
        router.push(next);
        router.refresh();
      } else {
        const result = await signUp(cleanEmail, password, displayName);
        if (result.status === "signed_in") {
          router.push(next);
          router.refresh();
        } else {
          setSentEmail(cleanEmail);
          setPassword("");
          setConfirm("");
        }
      }
    } catch (err) {
      setError(authErrorMessage(err instanceof Error ? err.message : ""));
    } finally {
      setBusy(false);
    }
  }

  async function handleSignOut() {
    setBusy(true);
    setError(null);
    try {
      await signOut();
      setNotice("已退出登录。");
    } catch (err) {
      setError(authErrorMessage(err instanceof Error ? err.message : ""));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <p className="mono text-xs uppercase tracking-[0.18em] text-accent-ink">Account · Optional</p>
      <h1 className="mt-2 text-[30px] font-semibold leading-tight tracking-tight">
        登录后，把选型过程留下来。
      </h1>
      <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-ink-3">
        浏览榜单、筛选与成本试算不需要账号。登录用于保存收藏型号、对比清单和顾问对话，换设备也能接上。
      </p>

      {loading ? (
        <div className="card mt-6 h-64 animate-pulse bg-surface-2" aria-label="正在读取登录状态" />
      ) : !configured ? (
        <div className="mt-6 space-y-3">
          <SupabaseSetup />
          <p className="text-[13px] text-ink-4">
            填好环境变量并重启后，回到本页即可注册。此前的本地功能都不受影响。
          </p>
          <Link href="/" className="btn-ghost h-9 px-4">
            返回工作台
          </Link>
        </div>
      ) : user ? (
        <div className="card mt-6 p-5">
          <h2 className="text-lg font-semibold">已登录</h2>
          <p className="mt-2 text-sm text-ink-3">
            {userLabel(user)}
            {user.email ? ` · ${user.email}` : ""}
          </p>
          {(notice || error) && (
            <p
              className={`mt-3 rounded-lg px-3 py-2 text-[13px] ${
                error ? "bg-danger-soft text-danger" : "bg-ok-soft text-ok"
              }`}
            >
              {error ?? notice}
            </p>
          )}
          <div className="mt-5 flex flex-wrap gap-2">
            <Link href="/account" className="btn-primary h-9 px-4 text-[13px]">
              进入账户
            </Link>
            <Link href="/" className="btn-ghost h-9 px-4">
              继续浏览
            </Link>
            <button
              type="button"
              onClick={() => void handleSignOut()}
              disabled={busy}
              className="h-9 rounded-lg px-3 text-[13px] text-danger transition hover:bg-danger-soft disabled:opacity-50"
            >
              退出登录
            </button>
          </div>
        </div>
      ) : sentEmail ? (
        <div className="card mt-6 p-5">
          <h2 className="text-lg font-semibold">验证邮件已发送</h2>
          <p className="mt-2 text-sm leading-relaxed text-ink-3">
            如果 <span className="font-medium text-ink">{sentEmail}</span>{" "}
            可用于注册，你会收到一封验证邮件。点开邮件里的链接后，再回来登录。
          </p>
          <p className="mt-2 text-[12px] leading-relaxed text-ink-4">
            没收到可检查垃圾邮件；本地开发也可以在 Supabase 的 Email 设置里关闭 Confirm email。
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                setSentEmail(null);
                setMode("login");
                setNotice("邮箱验证后，用同一邮箱和密码登录。");
              }}
              className="btn-primary h-9 px-4 text-[13px]"
            >
              我已验证，去登录
            </button>
            <button
              type="button"
              onClick={() => setSentEmail(null)}
              className="btn-ghost h-9 px-4"
            >
              返回
            </button>
          </div>
        </div>
      ) : (
        <div className="card mt-6 p-5 sm:p-6">
          <div className="flex gap-1 rounded-full border border-line bg-surface-2 p-0.5" role="tablist" aria-label="登录或注册">
            {(
              [
                ["login", "登录"],
                ["register", "注册"],
              ] as [Mode, string][]
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={mode === value}
                onClick={() => switchMode(value)}
                className={`h-8 flex-1 rounded-full text-[13px] transition ${
                  mode === value
                    ? "bg-surface font-semibold text-ink shadow-card"
                    : "text-ink-4 hover:text-ink"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <form className="mt-4 space-y-3.5" onSubmit={submit}>
            {mode === "register" && (
              <div>
                <label htmlFor="account-name" className="block text-[13px] font-medium text-ink-2">
                  显示名 <span className="font-normal text-ink-4">（可选）</span>
                </label>
                <input
                  id="account-name"
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  maxLength={40}
                  autoComplete="nickname"
                  placeholder="例如：鲁婷"
                  className="mt-1.5 h-10 w-full rounded-lg border border-line bg-sunk px-3 text-sm text-ink outline-none transition placeholder:text-ink-4 focus:border-accent"
                />
              </div>
            )}

            <div>
              <label htmlFor="account-email" className="block text-[13px] font-medium text-ink-2">
                邮箱
              </label>
              <input
                id="account-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
                spellCheck={false}
                placeholder="you@example.com"
                className="mt-1.5 h-10 w-full rounded-lg border border-line bg-sunk px-3 text-sm text-ink outline-none transition placeholder:text-ink-4 focus:border-accent"
              />
            </div>

            <div>
              <label htmlFor="account-password" className="block text-[13px] font-medium text-ink-2">
                密码
              </label>
              <input
                id="account-password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                placeholder="至少 8 个字符"
                className="mt-1.5 h-10 w-full rounded-lg border border-line bg-sunk px-3 text-sm text-ink outline-none transition placeholder:text-ink-4 focus:border-accent"
              />
            </div>

            {mode === "register" && (
              <div>
                <label htmlFor="account-confirm" className="block text-[13px] font-medium text-ink-2">
                  再输一次密码
                </label>
                <input
                  id="account-confirm"
                  type="password"
                  value={confirm}
                  onChange={(event) => setConfirm(event.target.value)}
                  autoComplete="new-password"
                  placeholder="确认密码"
                  className="mt-1.5 h-10 w-full rounded-lg border border-line bg-sunk px-3 text-sm text-ink outline-none transition placeholder:text-ink-4 focus:border-accent"
                />
              </div>
            )}

            {(error || notice) && (
              <p
                className={`rounded-lg px-3 py-2 text-[13px] leading-relaxed ${
                  error ? "bg-danger-soft text-danger" : "bg-ok-soft text-ok"
                }`}
              >
                {error ?? notice}
              </p>
            )}

            <button
              type="submit"
              disabled={busy}
              className="btn-primary h-10 w-full justify-center text-sm disabled:cursor-wait disabled:opacity-60"
            >
              {busy ? "处理中…" : mode === "login" ? "登录" : "注册"}
            </button>
          </form>

          <p className="mt-4 text-[11px] leading-relaxed text-ink-4">
            注册后可能需要点开验证邮件才能登录。账号只用于保存数据，不用于调用模型；对话 API Key 仍然只保存在本浏览器。
          </p>
        </div>
      )}
    </div>
  );
}