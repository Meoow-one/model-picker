"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";
import SupabaseSetup from "@/components/auth/SupabaseSetup";
import {
  deleteComparison,
  deleteThread,
  listComparisons,
  listFavorites,
  listThreads,
  removeFavorite,
  type ComparisonRow,
  type FavoriteRow,
  type ThreadRow,
} from "@/lib/account";
import { accountErrorMessage, userLabel } from "@/lib/account-utils";
import { formatContext, formatPrice, priceIn, vendorLabel } from "@/lib/leaderboard";
import type { Model } from "@/lib/types";

type AccountData = {
  favorites: FavoriteRow[];
  comparisons: ComparisonRow[];
  threads: ThreadRow[];
};

function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export default function AccountView({ models }: { models: Model[] }) {
  const router = useRouter();
  const { configured, loading, user, signOut } = useAuth();
  const userId = user?.id ?? null;

  const [data, setData] = useState<AccountData | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [reload, setReload] = useState(0);

  const modelById = useMemo(() => new Map(models.map((model) => [model.id, model])), [models]);

  useEffect(() => {
    if (!userId) {
      setData(null);
      setState("idle");
      return;
    }
    let active = true;
    setState("loading");
    setError(null);
    Promise.all([
      listFavorites(userId),
      listComparisons(userId),
      listThreads(userId),
    ])
      .then(([favorites, comparisons, threads]) => {
        if (!active) return;
        setData({ favorites, comparisons, threads });
        setState("ready");
      })
      .catch((err) => {
        if (!active) return;
        setError(accountErrorMessage(err));
        setState("error");
      });
    return () => {
      active = false;
    };
  }, [userId, reload]);

  async function handleRemoveFavorite(modelId: string) {
    if (!userId) return;
    setBusyKey(`fav:${modelId}`);
    setActionError(null);
    try {
      await removeFavorite(userId, modelId);
      setData((prev) =>
        prev ? { ...prev, favorites: prev.favorites.filter((row) => row.model_id !== modelId) } : prev,
      );
    } catch (err) {
      setActionError(accountErrorMessage(err));
    } finally {
      setBusyKey(null);
    }
  }

  async function handleDeleteComparison(row: ComparisonRow) {
    if (!userId) return;
    if (!window.confirm(`删除对比清单「${row.name}」？`)) return;
    setBusyKey(`cmp:${row.id}`);
    setActionError(null);
    try {
      await deleteComparison(userId, row.id);
      setData((prev) =>
        prev ? { ...prev, comparisons: prev.comparisons.filter((item) => item.id !== row.id) } : prev,
      );
    } catch (err) {
      setActionError(accountErrorMessage(err));
    } finally {
      setBusyKey(null);
    }
  }

  async function handleDeleteThread(row: ThreadRow) {
    if (!userId) return;
    if (!window.confirm(`删除对话「${row.title}」？相关的消息会一起删除。`)) return;
    setBusyKey(`thread:${row.id}`);
    setActionError(null);
    try {
      await deleteThread(userId, row.id);
      setData((prev) =>
        prev ? { ...prev, threads: prev.threads.filter((item) => item.id !== row.id) } : prev,
      );
    } catch (err) {
      setActionError(accountErrorMessage(err));
    } finally {
      setBusyKey(null);
    }
  }

  async function handleSignOut() {
    setBusyKey("signout");
    setActionError(null);
    try {
      await signOut();
      router.push("/");
      router.refresh();
    } catch (err) {
      setActionError(accountErrorMessage(err));
    } finally {
      setBusyKey(null);
    }
  }

  if (loading) {
    return (
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">账户</h1>
        <div className="card mt-5 h-48 animate-pulse bg-surface-2" aria-label="正在读取账户" />
      </div>
    );
  }

  if (!configured) {
    return (
      <div>
        <p className="mono text-xs uppercase tracking-[0.18em] text-accent-ink">Account</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">账户</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-3">
          账号数据保存在你自己的 Supabase 项目里。配置之前，榜单、成本试算和本地对话功能都可以正常使用。
        </p>
        <div className="mt-5 space-y-4">
          <Benefits />
          <SupabaseSetup />
          <Link href="/leaderboard" className="btn-ghost h-9 px-4">
            先去榜单看看
          </Link>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div>
        <p className="mono text-xs uppercase tracking-[0.18em] text-accent-ink">Account · Optional</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">账户</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-3">
          不登录也能浏览榜单、试算成本。登录后，收藏、对比清单和对话历史会跟着账号走。
        </p>
        <div className="mt-5 space-y-4">
          <Benefits />
          <div className="flex flex-wrap gap-2">
            <Link href="/login?next=%2Faccount" className="btn-primary h-9 px-4 text-[13px]">
              登录 / 注册
            </Link>
            <Link href="/leaderboard" className="btn-ghost h-9 px-4">
              先去看榜单
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const name = userLabel(user);

  return (
    <div>
      <p className="mono text-xs uppercase tracking-[0.18em] text-accent-ink">Account</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">账户</h1>

      <section className="card mt-5 p-5">
        <div className="flex flex-wrap items-center gap-4">
          <span className="grid h-12 w-12 flex-none place-items-center rounded-full bg-accent-soft text-lg font-semibold text-accent-ink">
            {name.slice(0, 1).toUpperCase()}
          </span>
          <div className="min-w-0">
            <p className="truncate text-lg font-semibold text-ink">{name}</p>
            <p className="truncate text-[13px] text-ink-4">{user.email}</p>
            <p className="mt-0.5 text-[11px] text-ink-4">注册于 {formatDate(user.created_at)}</p>
          </div>
          <div className="ml-auto flex flex-wrap gap-2">
            <Link href="/chat" className="btn-ghost h-8 px-3 text-[13px]">
              去问顾问
            </Link>
            <button
              type="button"
              onClick={() => void handleSignOut()}
              disabled={busyKey === "signout"}
              className="h-8 rounded-lg px-3 text-[13px] text-danger transition hover:bg-danger-soft disabled:opacity-50"
            >
              退出登录
            </button>
          </div>
        </div>
        <p className="mt-4 rounded-lg bg-sunk px-3 py-2 text-[11px] leading-relaxed text-ink-4">
          数据存在你自己的 Supabase 项目，启用 RLS，只有当前登录用户能读写。对话 API Key 不随账号保存；不想留的数据可在这里逐条删除。
        </p>
      </section>

      {actionError && (
        <p className="mt-3 rounded-lg bg-danger-soft px-3 py-2 text-[13px] leading-relaxed text-danger">
          {actionError}
        </p>
      )}

      {state === "loading" && !data && (
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          <div className="card h-40 animate-pulse bg-surface-2" />
          <div className="card h-40 animate-pulse bg-surface-2" />
        </div>
      )}

      {state === "error" && (
        <div className="card mt-4 p-5">
          <h2 className="text-[15px] font-semibold text-ink">账户数据读取失败</h2>
          <p className="mt-2 text-[13px] leading-relaxed text-danger">{error}</p>
          <button
            type="button"
            onClick={() => setReload((value) => value + 1)}
            className="btn-ghost mt-4 h-9 px-4"
          >
            重试
          </button>
        </div>
      )}

      {data && (
        <div className="mt-4 space-y-4">
          <section className="card p-5">
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="text-[15px] font-semibold text-ink">
                收藏型号 <span className="ml-1 text-xs font-normal text-ink-4">{data.favorites.length}</span>
              </h2>
              <Link href="/leaderboard" className="text-[12px] text-accent-ink hover:underline">
                去榜单收藏
              </Link>
            </div>
            {data.favorites.length === 0 ? (
              <p className="mt-2 text-[13px] leading-relaxed text-ink-4">
                还没有收藏。在榜单里点型号名旁边的星标，回来就能看到。
              </p>
            ) : (
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {data.favorites.map((row) => {
                  const model = modelById.get(row.model_id);
                  const cny = model ? priceIn(model, "CNY") : null;
                  const usd = model ? priceIn(model, "USD") : null;
                  const priceText = cny
                    ? `${formatPrice(cny.input, "CNY")} /M`
                    : usd
                      ? `${formatPrice(usd.input, "USD")} /M（美元）`
                      : "无公开价";
                  return (
                    <div
                      key={row.model_id}
                      className="flex items-start justify-between gap-3 rounded-lg border border-line bg-surface-2 p-3"
                    >
                      <div className="min-w-0">
                        {model ? (
                          <>
                            <Link
                              href={`/leaderboard?q=${encodeURIComponent(model.name)}`}
                              className="text-[14px] font-medium text-ink transition hover:text-accent-ink"
                            >
                              {model.name}
                            </Link>
                            <p className="mt-0.5 text-[11.5px] text-ink-4">
                              {vendorLabel(model.vendor)} · {formatContext(model.contextWindow)} ·{" "}
                              {priceText}
                            </p>
                          </>
                        ) : (
                          <>
                            <p className="text-[14px] font-medium text-ink">{row.model_id}</p>
                            <p className="mt-0.5 text-[11.5px] text-warn">该型号已不在当前清单中</p>
                          </>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => void handleRemoveFavorite(row.model_id)}
                        disabled={busyKey === `fav:${row.model_id}`}
                        className="shrink-0 text-[11.5px] text-ink-4 transition hover:text-danger disabled:opacity-50"
                      >
                        移除
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <section className="card p-5">
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="text-[15px] font-semibold text-ink">
                对比清单 <span className="ml-1 text-xs font-normal text-ink-4">{data.comparisons.length}</span>
              </h2>
              <Link href="/leaderboard" className="text-[12px] text-accent-ink hover:underline">
                新建对比
              </Link>
            </div>
            {data.comparisons.length === 0 ? (
              <p className="mt-2 text-[13px] leading-relaxed text-ink-4">
                还没有保存的对比。在榜单勾选 2–4 个型号，打开「对比」后点「保存到账户」。
              </p>
            ) : (
              <ul className="mt-3 divide-y divide-line">
                {data.comparisons.map((row) => {
                  const names = row.model_ids
                    .map((id) => modelById.get(id)?.name ?? "已下架型号")
                    .join(" · ");
                  return (
                    <li key={row.id} className="flex flex-wrap items-start justify-between gap-3 py-3 first:pt-1 last:pb-1">
                      <div className="min-w-0">
                        <p className="text-[14px] font-medium text-ink">{row.name}</p>
                        <p className="mt-0.5 text-[12px] leading-relaxed text-ink-4">{names}</p>
                        <p className="mt-0.5 text-[11px] text-ink-4">{formatDate(row.created_at)}</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <Link
                          href={`/leaderboard?compare=${encodeURIComponent(row.model_ids.join(","))}`}
                          className="btn-ghost h-8 px-3 text-[12px]"
                        >
                          打开
                        </Link>
                        <button
                          type="button"
                          onClick={() => void handleDeleteComparison(row)}
                          disabled={busyKey === `cmp:${row.id}`}
                          className="h-8 rounded-lg px-2.5 text-[12px] text-ink-4 transition hover:bg-danger-soft hover:text-danger disabled:opacity-50"
                        >
                          删除
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section className="card p-5">
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="text-[15px] font-semibold text-ink">
                对话历史 <span className="ml-1 text-xs font-normal text-ink-4">{data.threads.length}</span>
              </h2>
              <Link href="/chat" className="text-[12px] text-accent-ink hover:underline">
                去问顾问
              </Link>
            </div>
            {data.threads.length === 0 ? (
              <p className="mt-2 text-[13px] leading-relaxed text-ink-4">
                还没有对话记录。登录状态下在选型顾问里提问，问答会自动保存到这里。
              </p>
            ) : (
              <ul className="mt-3 divide-y divide-line">
                {data.threads.map((row) => (
                  <li key={row.id} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-1 last:pb-1">
                    <div className="min-w-0">
                      <Link
                        href={`/chat?thread=${row.id}`}
                        className="block truncate text-[14px] font-medium text-ink transition hover:text-accent-ink"
                      >
                        {row.title}
                      </Link>
                      <p className="mt-0.5 text-[11px] text-ink-4">更新于 {formatDate(row.updated_at)}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Link href={`/chat?thread=${row.id}`} className="btn-ghost h-8 px-3 text-[12px]">
                        打开
                      </Link>
                      <button
                        type="button"
                        onClick={() => void handleDeleteThread(row)}
                        disabled={busyKey === `thread:${row.id}`}
                        className="h-8 rounded-lg px-2.5 text-[12px] text-ink-4 transition hover:bg-danger-soft hover:text-danger disabled:opacity-50"
                      >
                        删除
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {state === "loading" && <p className="text-[11px] text-ink-4">正在刷新账户数据…</p>}
        </div>
      )}
    </div>
  );
}

function Benefits() {
  return (
    <section className="card p-5">
      <h2 className="text-[15px] font-semibold text-ink">登录后多出来的三件事</h2>
      <ul className="mt-2.5 list-disc space-y-2 pl-5 text-[13px] leading-relaxed text-ink-2 marker:text-accent/60">
        <li>收藏型号：在榜单点星标，账户页集中查看。</li>
        <li>对比清单：保存 2–4 个候选，下次从「打开」直接回到对比。</li>
        <li>对话历史：顾问问答自动保存，换设备登录也能接着看。</li>
      </ul>
      <p className="mt-3 text-[11px] leading-relaxed text-ink-4">
        账号只负责保存这些数据；浏览、筛选、成本试算不需要登录，模型 API Key 仍然只存本浏览器。
      </p>
    </section>
  );
}