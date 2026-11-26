"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/auth/AuthProvider";
import { appendMessage, createThread, loadThread, touchThread } from "@/lib/account";
import {
  accountErrorMessage,
  userLabel,
  type ChatCitation as Citation,
} from "@/lib/account-utils";

type Turn = {
  role: "user" | "assistant";
  content: string;
  citations?: Citation[];
  error?: boolean;
};

type LlmSettings = {
  key: string;
  model: string;
  baseUrl: string;
};

const STORAGE_KEY = "mp-llm-settings";
const EMPTY_SETTINGS: LlmSettings = { key: "", model: "", baseUrl: "" };

const EXAMPLES = [
  "预算 3000 元/月，客服机器人日均 2000 次，每次输入 800、输出 300 token，选哪个？",
  "需要 1M 上下文、能调用工具、支持缓存，有哪些型号？",
  "对比 qwen4-max、deepseek-v4.1-pro 和 glm-5.3 的价格与能力",
];

function readSettings(): LlmSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<LlmSettings>;
    return {
      key: typeof parsed.key === "string" ? parsed.key : "",
      model: typeof parsed.model === "string" ? parsed.model : "",
      baseUrl: typeof parsed.baseUrl === "string" ? parsed.baseUrl : "",
    };
  } catch {
    return EMPTY_SETTINGS;
  }
}

function maskKey(key: string): string {
  return key.length <= 8 ? "已保存" : `已保存 · …${key.slice(-4)}`;
}

function errorText(code: string, message?: string): string {
  switch (code) {
    case "missing_key":
      return "还没有配置 API Key。点右上角「模型设置」填写自己的密钥，密钥只保存在本机浏览器。";
    case "invalid_key":
      return "API Key 无效或没有该模型权限（401）。请检查是否复制完整、账户是否已开通。";
    case "invalid_base_url":
      return "自定义端点必须是 https 公网地址，且不能带账号密码。留空则使用 DeepSeek 默认端点。";
    case "rate_limited":
      return "请求太频繁，已触发本站限流，请五分钟后再试。";
    case "upstream_limited":
      return "上游模型限流（429），请稍后重试或换一个模型名。";
    case "budget_exceeded":
      return "站点今日的免费额度已用完。请填写自己的 API Key 继续使用。";
    case "timeout":
      return "上游响应超时，请稍后重试。";
    default:
      return message || "请求失败，请稍后重试。";
  }
}

export default function AssistantChat({ modelCount }: { modelCount: number }) {
  const { user, loading: authLoading } = useAuth();
  const userId = user?.id ?? null;
  const [settings, setSettings] = useState<LlmSettings>(EMPTY_SETTINGS);
  const [draft, setDraft] = useState<LlmSettings>(EMPTY_SETTINGS);
  const [loaded, setLoaded] = useState(false);
  const [serverKey, setServerKey] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [threadParam, setThreadParam] = useState<string | null>(null);
  const [threadLoading, setThreadLoading] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const loadedThreadRef = useRef<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const stored = readSettings();
    setSettings(stored);
    setDraft(stored);
    setLoaded(true);
    inputRef.current?.focus();
    fetch("/api/chat")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setServerKey(Boolean(data?.serverKey)))
      .catch(() => setServerKey(false));
  }, []);

  // 账号切换时清空当前会话，避免把上一个账号的历史带进新账号
  useEffect(() => {
    setTurns([]);
    setThreadId(null);
    setSyncError(null);
    loadedThreadRef.current = null;
  }, [userId]);

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("thread");
    setThreadParam(id);
  }, []);

  useEffect(() => {
    if (!userId || !threadParam || loadedThreadRef.current === threadParam) return;
    loadedThreadRef.current = threadParam;
    let active = true;
    setThreadLoading(true);
    setError(null);
    setSyncError(null);
    loadThread(threadParam)
      .then(({ messages }) => {
        if (!active) return;
        setThreadId(threadParam);
        setTurns(
          messages.map((message) => ({
            role: message.role,
            content: message.content,
            citations: message.role === "assistant" ? message.citations : undefined,
          })),
        );
      })
      .catch((err) => {
        if (active) setError(accountErrorMessage(err));
      })
      .finally(() => {
        if (active) setThreadLoading(false);
      });
    return () => {
      active = false;
    };
  }, [userId, threadParam]);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [turns, busy]);

  useEffect(() => {
    if (!settingsOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSettingsOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [settingsOpen]);

  const hasKey = settings.key !== "" || serverKey;

  function openSettings() {
    setDraft(settings);
    setShowKey(false);
    setSettingsOpen(true);
  }

  function saveSettings() {
    const next: LlmSettings = {
      key: draft.key.trim(),
      model: draft.model.trim(),
      baseUrl: draft.baseUrl.trim(),
    };
    try {
      if (next.key === "" && next.model === "" && next.baseUrl === "") {
        localStorage.removeItem(STORAGE_KEY);
      } else {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      }
    } catch {
      // 隐私模式下 localStorage 可能不可写，本次会话仍可用
    }
    setSettings(next);
    setSettingsOpen(false);
    setError(null);
    inputRef.current?.focus();
  }

  function clearKey() {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
    setSettings(EMPTY_SETTINGS);
    setDraft(EMPTY_SETTINGS);
    setSettingsOpen(false);
  }

  async function submit(text: string) {
    const question = text.trim();
    if (!question || busy || threadLoading) return;
    if (!hasKey) {
      setError(errorText("missing_key"));
      openSettings();
      return;
    }

    const history = turns
      .filter((turn) => !turn.error)
      .map((turn) => ({ role: turn.role, content: turn.content }));
    const nextTurns: Turn[] = [...turns, { role: "user", content: question }];
    setTurns(nextTurns);
    setInput("");
    setBusy(true);
    setError(null);
    setSyncError(null);

    const uid = user?.id ?? null;
    // 账号保存与模型请求并行，不让 Supabase 的延迟拖慢回答
    const persistence: Promise<string | null> = uid
      ? (async () => {
          let target = threadId;
          if (!target) {
            const thread = await createThread(uid, question);
            target = thread.id;
            setThreadId(thread.id);
            loadedThreadRef.current = thread.id;
          }
          await appendMessage(uid, target, "user", question, []);
          return target;
        })().catch((err) => {
          setSyncError(accountErrorMessage(err));
          return null;
        })
      : Promise.resolve(null);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(settings.key ? { "x-llm-key": settings.key } : {}),
        },
        body: JSON.stringify({
          messages: [...history, { role: "user", content: question }],
          model: settings.model || undefined,
          baseUrl: settings.baseUrl || undefined,
        }),
      });

      const data = (await res.json().catch(() => null)) as
        | { content?: string; citations?: Citation[]; error?: string; message?: string }
        | null;

      if (!res.ok) {
        setError(errorText(data?.error ?? "upstream_error", data?.message));
        return;
      }
      if (!data?.content) {
        setError(errorText("upstream_error", "模型没有返回内容，请换个问法重试。"));
        return;
      }
      const assistantText = data.content;
      const citations = data.citations ?? [];
      setTurns((prev) => [
        ...prev,
        {
          role: "assistant",
          content: assistantText,
          citations,
        },
      ]);

      if (uid) {
        void persistence
          .then((target) => {
            if (!target) return;
            return appendMessage(uid, target, "assistant", assistantText, citations).then(() =>
              touchThread(uid, target),
            );
          })
          .catch((err) => setSyncError(accountErrorMessage(err)));
      }
    } catch {
      setError("网络请求失败，请检查本地服务是否在运行。");
    } finally {
      setBusy(false);
      window.setTimeout(() => inputRef.current?.focus(), 0);
    }
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      void submit(input);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">选型顾问</h1>
          <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-ink-4">
            基于站内 {modelCount} 个型号的榜单与价格回答。价格、上下文、分数只来自工具查询，不凭记忆生成；
            回答下方会附引用卡片，可跳回榜单核对。
          </p>
          {!authLoading &&
            (user ? (
              <p className="mt-1 text-xs text-ink-4">
                已登录为 {userLabel(user)} · 对话会自动保存到账户 ·{" "}
                <Link href="/account" className="text-accent-ink hover:underline">
                  查看历史
                </Link>
              </p>
            ) : (
              <p className="mt-1 text-xs text-ink-4">
                <Link
                  href="/login?next=%2Fchat"
                  className="text-accent-ink hover:underline"
                >
                  登录 / 注册
                </Link>
                后对话自动保存；不登录也能提问，但刷新即丢失。
              </p>
            ))}
        </div>
        <div className="flex flex-none items-center gap-2">
          <span
            className={`inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs ${
              hasKey
                ? "border-line bg-surface-2 text-ink-3"
                : "border-transparent bg-warn-soft text-warn"
            }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${hasKey ? "bg-ok" : "bg-warn"}`}
              aria-hidden="true"
            />
            {settings.key ? maskKey(settings.key) : serverKey ? "站点密钥" : "未配置密钥"}
          </span>
          <button type="button" onClick={openSettings} className="btn-ghost">
            模型设置
          </button>
        </div>
      </div>

      {threadParam && !authLoading && !user && (
        <p className="mt-3 rounded-lg border border-line bg-warn-soft px-3 py-2 text-[13px] leading-relaxed text-warn">
          这条对话历史需要登录后查看。
          <Link
            href={`/login?next=${encodeURIComponent(`/chat?thread=${threadParam}`)}`}
            className="ml-1 underline decoration-warn/40 underline-offset-2 hover:text-ink"
          >
            登录 / 注册
          </Link>
        </p>
      )}

      <section className="card mt-4 flex h-[calc(100dvh-15rem)] min-h-[480px] max-h-[900px] flex-col overflow-hidden">
        <div ref={listRef} className="flex-1 overflow-y-auto px-4 py-4 md:px-5">
          {threadLoading && (
            <div className="flex items-center gap-2 rounded-xl border border-line bg-surface-2 px-4 py-3 text-sm text-ink-4">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" aria-hidden="true" />
              正在读取历史对话…
            </div>
          )}

          {loaded && !threadLoading && turns.length === 0 && (
            <div className="mx-auto max-w-xl py-6 text-center">
              <p className="text-[15px] font-medium text-ink">先说说你的场景</p>
              <p className="mt-1.5 text-sm leading-relaxed text-ink-4">
                业务量、模态、上下文、预算——给得越具体，「成本试算」和榜单筛选就越准。
              </p>
              <div className="mt-4 flex flex-col gap-2 text-left">
                {EXAMPLES.map((example) => (
                  <button
                    key={example}
                    type="button"
                    onClick={() => {
                      setInput(example);
                      inputRef.current?.focus();
                    }}
                    className="rounded-lg border border-line bg-surface-2 px-3.5 py-2.5 text-[13px] leading-relaxed text-ink-3 transition hover:border-accent/40 hover:text-ink"
                  >
                    {example}
                  </button>
                ))}
              </div>
              {!hasKey && loaded && (
                <p className="mt-4 rounded-lg border border-line bg-warn-soft px-3 py-2 text-xs leading-relaxed text-warn">
                  首次使用请先在「模型设置」里填写自己的 API Key。密钥只保存在本浏览器，服务端不落库。
                </p>
              )}
            </div>
          )}

          <div className="flex flex-col gap-3">
            {turns.map((turn, index) =>
              turn.role === "user" ? (
                <div key={index} className="flex justify-end">
                  <div className="max-w-[85%] whitespace-pre-wrap rounded-xl rounded-br-sm bg-accent-soft px-4 py-2.5 text-sm leading-relaxed text-ink">
                    {turn.content}
                  </div>
                </div>
              ) : (
                <div key={index} className="flex justify-start">
                  <div className="max-w-[92%]">
                    <div className="mb-1 text-[11px] font-medium uppercase tracking-[0.08em] text-accent-ink">
                      顾问
                    </div>
                    <div className="whitespace-pre-wrap rounded-xl rounded-bl-sm border border-line bg-surface-2 px-4 py-3 text-sm leading-relaxed text-ink-2">
                      {turn.content}
                    </div>
                    {turn.citations && turn.citations.length > 0 && (
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        <span className="text-[11px] text-ink-4">引用</span>
                        {turn.citations.map((citation) => (
                          <Link
                            key={citation.id}
                            href={`/leaderboard?q=${encodeURIComponent(citation.name)}`}
                            title={`在榜单中查看 ${citation.name} 的价格与来源`}
                            className="chip"
                          >
                            {citation.name}
                            <span className="ml-1 opacity-60">{citation.vendor}</span>
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ),
            )}

            {busy && (
              <div className="flex justify-start">
                <div className="flex items-center gap-2 rounded-xl border border-line bg-surface-2 px-4 py-3 text-sm text-ink-4">
                  <span className="flex gap-1" aria-hidden="true">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent [animation-delay:120ms]" />
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent [animation-delay:240ms]" />
                  </span>
                  正在查站内数据并试算…
                </div>
              </div>
            )}
          </div>

          {error && (
            <p className="mt-3 rounded-lg border border-transparent bg-danger-soft px-3 py-2 text-[13px] leading-relaxed text-danger">
              {error}
            </p>
          )}
          {syncError && (
            <p className="mt-3 rounded-lg border border-transparent bg-warn-soft px-3 py-2 text-[13px] leading-relaxed text-warn">
              本次对话未保存到账户：{syncError} 回答仍可正常查看。
            </p>
          )}
        </div>

        <div className="border-t border-line p-3 md:p-4">
          <div className="flex items-end gap-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={onKeyDown}
              rows={3}
              placeholder={
                hasKey
                  ? "问：客服机器人日均 2000 次，预算 3000 元/月，选哪个？"
                  : "先在「模型设置」填写 API Key，再开始提问"
              }
              className="min-h-[76px] flex-1 resize-none rounded-lg border border-line bg-sunk px-3 py-2.5 text-sm leading-relaxed text-ink outline-none transition placeholder:text-ink-4 focus:border-accent"
            />
            <div className="flex flex-col items-stretch gap-1.5">
              <button
                type="button"
                onClick={() => void submit(input)}
                disabled={busy || threadLoading || input.trim() === ""}
                className="btn-primary h-10 px-4 text-sm"
              >
                发送
              </button>
              {turns.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setTurns([]);
                    setError(null);
                    setSyncError(null);
                    setThreadId(null);
                    loadedThreadRef.current = null;
                    if (threadParam) {
                      window.history.replaceState(null, "", "/chat");
                      setThreadParam(null);
                    }
                  }}
                  disabled={busy}
                  className="h-7 text-xs text-ink-4 underline-offset-4 transition hover:text-ink hover:underline disabled:opacity-40"
                >
                  清空对话
                </button>
              )}
            </div>
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-ink-4">
            Enter 发送，Shift + Enter 换行。回答由你配置的模型生成，可能出错；价格与分数请以引用卡片和厂商来源页为准。
            {authLoading
              ? " 正在读取账户状态…"
              : user
                ? " 对话会保存到你的账户，可在账户页删除；API Key 仍只保存在本浏览器，服务端不落库。"
                : " 未登录：对话只在本次页面有效，刷新即丢失；登录后才会保存历史。API Key 仍只保存在本浏览器。"}
          </p>
        </div>
      </section>

      {settingsOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="模型设置"
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-[#081120]/55 p-4 backdrop-blur-[2px] sm:p-8"
          onClick={() => setSettingsOpen(false)}
        >
          <div className="card w-full max-w-md p-5 shadow-float" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">模型设置</h2>
              <button
                type="button"
                onClick={() => setSettingsOpen(false)}
                className="h-8 rounded-lg px-2.5 text-[13px] text-ink-3 transition hover:bg-sunk hover:text-ink"
              >
                关闭
              </button>
            </div>

            <label className="mt-4 block text-[13px] font-medium text-ink-2" htmlFor="llm-key">
              API Key
            </label>
            <div className="mt-1.5 flex gap-2">
              <input
                id="llm-key"
                type={showKey ? "text" : "password"}
                value={draft.key}
                onChange={(event) => setDraft((prev) => ({ ...prev, key: event.target.value }))}
                autoComplete="off"
                spellCheck={false}
                placeholder="sk-..."
                className="h-10 min-w-0 flex-1 rounded-lg border border-line bg-sunk px-3 font-mono text-sm text-ink outline-none transition placeholder:text-ink-4 focus:border-accent"
              />
              <button
                type="button"
                onClick={() => setShowKey((value) => !value)}
                className="btn-ghost h-10 shrink-0 text-[13px]"
              >
                {showKey ? "隐藏" : "显示"}
              </button>
            </div>

            <label className="mt-4 block text-[13px] font-medium text-ink-2" htmlFor="llm-model">
              模型名
            </label>
            <input
              id="llm-model"
              value={draft.model}
              onChange={(event) => setDraft((prev) => ({ ...prev, model: event.target.value }))}
              placeholder="deepseek-chat"
              spellCheck={false}
              className="mt-1.5 h-10 w-full rounded-lg border border-line bg-sunk px-3 font-mono text-sm text-ink outline-none transition placeholder:text-ink-4 focus:border-accent"
            />
            <p className="mt-1 text-[11px] leading-relaxed text-ink-4">
              留空用 deepseek-chat。需要更强推理可换 deepseek-reasoner，但响应更慢。
            </p>

            <details className="mt-4 rounded-lg border border-line bg-surface-2 px-3 py-2">
              <summary className="cursor-pointer text-[13px] font-medium text-ink-3">
                高级：自定义 OpenAI 兼容端点
              </summary>
              <label className="mt-3 block text-[13px] font-medium text-ink-2" htmlFor="llm-base">
                Base URL
              </label>
              <input
                id="llm-base"
                value={draft.baseUrl}
                onChange={(event) => setDraft((prev) => ({ ...prev, baseUrl: event.target.value }))}
                placeholder="https://api.deepseek.com"
                spellCheck={false}
                className="mt-1.5 h-10 w-full rounded-lg border border-line bg-sunk px-3 font-mono text-sm text-ink outline-none transition placeholder:text-ink-4 focus:border-accent"
              />
              <p className="mt-1 text-[11px] leading-relaxed text-ink-4">
                只接受 https 公网地址；不要带账号密码。留空使用 DeepSeek 默认端点。
              </p>
            </details>

            <p className="mt-4 rounded-lg border border-line bg-sunk px-3 py-2 text-[11px] leading-relaxed text-ink-3">
              密钥只保存在本浏览器的 localStorage，随请求头发送；服务端只做转发，不落库、不写日志。
              共用电脑请用后点「清除密钥」。Key 的用量费用由你自己的模型账户承担。
            </p>

            <div className="mt-5 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={clearKey}
                className="h-9 rounded-lg px-2.5 text-[13px] text-danger transition hover:bg-danger-soft"
              >
                清除密钥
              </button>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setSettingsOpen(false)}
                  className="btn-ghost h-9 px-3.5"
                >
                  取消
                </button>
                <button type="button" onClick={saveSettings} className="btn-primary h-9 px-4 text-[13px]">
                  保存
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}