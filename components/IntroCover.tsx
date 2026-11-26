"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";
import { userLabel } from "@/lib/account-utils";
import { INTRO_EVENT, INTRO_KEY, markIntroDone } from "@/lib/intro";

const FLOW = [
  {
    step: "01",
    title: "选场景",
    detail: "综合、代码、长文、RAG、性价比、高速低价",
  },
  {
    step: "02",
    title: "锁能力",
    detail: "工具调用、推理、视觉、缓存、上下文下限",
  },
  {
    step: "03",
    title: "算成本",
    detail: "日请求 × 输入输出 token × 缓存命中",
  },
  {
    step: "04",
    title: "做决定",
    detail: "对比 2–4 个候选，回到厂商来源核对",
  },
];

export default function IntroCover({ modelCount }: { modelCount: number | null }) {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [visible, setVisible] = useState(false);
  const [closing, setClosing] = useState(false);
  const primaryRef = useRef<HTMLButtonElement>(null);
  const closingRef = useRef(false);

  useEffect(() => {
    // 直接打开登录页时不要用封面挡住表单
    if (window.location.pathname.startsWith("/login")) return;
    try {
      if (localStorage.getItem(INTRO_KEY) !== "1") setVisible(true);
    } catch {
      setVisible(true);
    }
  }, []);

  useEffect(() => {
    const onShow = () => {
      closingRef.current = false;
      setClosing(false);
      setVisible(true);
    };
    window.addEventListener(INTRO_EVENT, onShow);
    return () => window.removeEventListener(INTRO_EVENT, onShow);
  }, []);

  useEffect(() => {
    if (!visible) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const shell = document.getElementById("app-shell");
    shell?.setAttribute("inert", "");
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") dismiss();
    };
    window.addEventListener("keydown", onKey);
    const timer = window.setTimeout(() => primaryRef.current?.focus({ preventScroll: true }), 80);
    return () => {
      document.body.style.overflow = previous;
      shell?.removeAttribute("inert");
      window.removeEventListener("keydown", onKey);
      window.clearTimeout(timer);
    };
  }, [visible]);

  function dismiss(next?: string) {
    if (closingRef.current) return;
    closingRef.current = true;
    markIntroDone();
    setClosing(true);
    window.setTimeout(() => {
      setVisible(false);
      setClosing(false);
      if (next) router.push(next);
    }, 260);
  }

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="intro-title"
      className={`fixed inset-0 z-[70] overflow-y-auto transition-opacity duration-300 ${
        closing ? "opacity-0" : "opacity-100"
      }`}
    >
      <div className="relative flex min-h-[100dvh] flex-col overflow-hidden bg-bg">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0">
          <div className="absolute inset-0 bg-[radial-gradient(120%_90%_at_12%_0%,var(--accent-soft),transparent_55%),radial-gradient(90%_70%_at_92%_100%,var(--accent-soft),transparent_62%)]" />
          <div className="absolute inset-0 opacity-40 [background-image:linear-gradient(to_right,var(--line)_1px,transparent_1px),linear-gradient(to_bottom,var(--line)_1px,transparent_1px)] [background-size:44px_44px]" />
          <div className="absolute -right-24 top-1/4 h-72 w-72 rounded-full border border-line opacity-60" />
          <div className="absolute -right-10 top-1/4 h-44 w-44 rounded-full border border-line opacity-80" />
        </div>

        <header className="intro-rise relative z-10 mx-auto flex w-full max-w-[1200px] items-center justify-between gap-4 px-6 py-6 md:px-10">
          <div className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-accent text-white">
              <svg width="18" height="18" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <rect x="1.5" y="1.5" width="5.4" height="5.4" rx="1.4" fill="currentColor" />
                <rect x="9.1" y="1.5" width="5.4" height="5.4" rx="1.4" fill="currentColor" opacity=".55" />
                <rect x="1.5" y="9.1" width="5.4" height="5.4" rx="1.4" fill="currentColor" opacity=".55" />
                <rect x="9.1" y="9.1" width="5.4" height="5.4" rx="1.4" fill="currentColor" />
              </svg>
            </span>
            <span className="leading-tight">
              <span className="block text-sm font-semibold tracking-tight">模型选型工作台</span>
              <span className="mt-0.5 block text-[10.5px] text-ink-4">国内大模型 · 可追溯</span>
            </span>
          </div>
          {
            authLoading ? (
              <span className="hidden items-center gap-1.5 rounded-full border border-line bg-surface/70 px-3 py-1.5 text-[11px] text-ink-3 sm:inline-flex">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-ink-4" aria-hidden="true" />
                读取账户…
              </span>
            ) : user ? (
              <button
                type="button"
                onClick={() => dismiss("/account")}
                className="hidden items-center gap-1.5 rounded-full border border-line bg-surface/70 px-3 py-1.5 text-[11px] text-ink-3 transition hover:text-ink sm:inline-flex"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-ok" aria-hidden="true" />
                已登录 · {userLabel(user)}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => dismiss("/login")}
                className="hidden items-center gap-1.5 rounded-full border border-line bg-surface/70 px-3 py-1.5 text-[11px] text-ink-3 transition hover:border-accent/40 hover:text-ink sm:inline-flex"
              >
                登录 / 注册
                <span aria-hidden="true">→</span>
              </button>
            )
          }
        </header>

        <main className="relative z-10 mx-auto grid w-full max-w-[1200px] flex-1 items-center gap-12 px-6 pb-12 pt-6 md:px-10 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-16 lg:pb-20">
          <div className="intro-rise max-w-2xl">
            <p className="mono text-[11px] uppercase tracking-[0.22em] text-accent-ink">
              Model Picker · For AI Product Managers
            </p>
            <h1
              id="intro-title"
              className="mt-5 text-[38px] font-semibold leading-[1.12] tracking-tight md:text-[56px]"
            >
              把模型选型，
              <br />
              变成一件有依据的事。
            </h1>
            <p className="mt-5 max-w-xl text-[15px] leading-relaxed text-ink-3 md:text-base">
              国内主流型号的 6 个场景子榜，价格逐条追溯到厂商定价页。先用榜单缩小范围，
              再把候选带进成本试算，确认这笔账单真的付得起。
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <button
                ref={primaryRef}
                type="button"
                onClick={() => dismiss()}
                className="btn-primary h-11 px-6 text-sm"
              >
                进入工作台 →
              </button>
              <button
                type="button"
                onClick={() => dismiss("/method")}
                className="btn-ghost h-11 px-4 text-sm"
              >
                先看数据口径
              </button>
            </div>
            <p className="mt-4 text-xs leading-relaxed text-ink-4">
              {authLoading ? (
                "正在读取账户状态…"
              ) : user ? (
                <>
                  已登录为 <span className="text-ink-3">{userLabel(user)}</span>
                  ；收藏、对比清单和对话会保存到账户。
                  <button
                    type="button"
                    onClick={() => dismiss("/account")}
                    className="ml-1 text-accent-ink underline decoration-line underline-offset-2 hover:text-accent"
                  >
                    去账户
                  </button>
                </>
              ) : (
                <>
                  浏览无需注册；
                  <button
                    type="button"
                    onClick={() => dismiss("/login")}
                    className="mx-1 text-accent-ink underline decoration-line underline-offset-2 hover:text-accent"
                  >
                    登录 / 注册
                  </button>
                  后可保存收藏、对比清单和对话历史。对话 API Key 仍只保存在你的浏览器。
                </>
              )}
            </p>

            <dl className="mt-10 grid max-w-lg grid-cols-3 gap-4 border-t border-line pt-5">
              <div>
                <dt className="text-[11px] text-ink-4">覆盖型号</dt>
                <dd className="mono mt-1 text-2xl font-semibold tracking-tight text-accent-ink">
                  {modelCount ?? "—"}
                </dd>
              </div>
              <div>
                <dt className="text-[11px] text-ink-4">场景子榜</dt>
                <dd className="mono mt-1 text-2xl font-semibold tracking-tight text-accent-ink">6</dd>
              </div>
              <div>
                <dt className="text-[11px] text-ink-4">汇率换算</dt>
                <dd className="mono mt-1 text-2xl font-semibold tracking-tight text-accent-ink">0</dd>
              </div>
            </dl>
          </div>

          <section className="intro-rise hidden lg:block" aria-label="选型流程">
            <div className="card relative p-5 shadow-float">
              <div className="flex items-center justify-between">
                <span className="text-[13px] font-semibold">一次完整的选型</span>
                <span className="mono text-[10px] uppercase tracking-[0.14em] text-ink-4">
                  workflow
                </span>
              </div>
              <ol className="mt-4 space-y-1">
                {FLOW.map((item, index) => (
                  <li key={item.step} className="relative flex gap-3.5 pb-4 last:pb-0">
                    {index < FLOW.length - 1 && (
                      <span
                        aria-hidden="true"
                        className="absolute left-[13px] top-8 h-[calc(100%-1.5rem)] w-px bg-line"
                      />
                    )}
                    <span
                      className={`mono relative z-10 grid h-7 w-7 flex-none place-items-center rounded-full border text-[10px] ${
                        index === 0
                          ? "border-transparent bg-accent text-white"
                          : "border-line bg-surface-2 text-ink-4"
                      }`}
                    >
                      {item.step}
                    </span>
                    <div className="min-w-0 pt-0.5">
                      <p className="text-[13px] font-medium text-ink">{item.title}</p>
                      <p className="mt-0.5 text-[11.5px] leading-relaxed text-ink-4">{item.detail}</p>
                    </div>
                  </li>
                ))}
              </ol>
              <div className="mt-4 flex items-center justify-between border-t border-line pt-3 text-[11px] text-ink-4">
                <span>不合并不同评测的总分</span>
                <span className="mono">v0.1</span>
              </div>
            </div>
          </section>
        </main>

        <footer className="intro-rise relative z-10 mx-auto w-full max-w-[1200px] px-6 pb-6 text-[11px] leading-relaxed text-ink-4 md:px-10">
          数据来自厂商公开定价页与公开评测，可能滞后，不构成采购建议。榜单与评测数据的版权归原机构。
        </footer>
      </div>
    </div>
  );
}