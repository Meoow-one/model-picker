"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import ThemeToggle from "@/components/ThemeToggle";
import { useAuth } from "@/components/auth/AuthProvider";
import { userLabel } from "@/lib/account-utils";
import { showIntro } from "@/lib/intro";

type Props = {
  modelCount: number | null;
  updatedAt: string | null;
};

const NAV = [
  { href: "/", label: "首页", icon: "home" as const },
  { href: "/leaderboard", label: "榜单", icon: "board" as const },
  { href: "/chat", label: "选型顾问", icon: "chat" as const },
  { href: "/calculator", label: "成本试算", icon: "calc" as const },
  { href: "/method", label: "方法论", icon: "book" as const },
];

export default function SiteSidebar({ modelCount, updatedAt }: Props) {
  const pathname = usePathname();
  const { user, loading } = useAuth();

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <>
      <aside className="sticky top-0 hidden h-screen flex-col gap-5 border-r border-line bg-sidebar px-3 py-4 md:flex">
        <Brand />

        <div className="px-2.5 text-[10.5px] uppercase tracking-[0.09em] text-ink-4">
          工作区
        </div>
        <nav className="flex flex-col gap-1.5" aria-label="主导航">
          {NAV.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-[15px] transition ${
                  active
                    ? "bg-accent-soft font-semibold text-ink"
                    : "font-medium text-ink-3 hover:bg-sunk hover:text-ink"
                }`}
              >
                <NavIcon
                  name={item.icon}
                  className={active ? "text-accent-ink" : "text-ink-4"}
                />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto flex flex-col gap-3 border-t border-line pt-3">
          {loading ? (
            <div className="h-10 animate-pulse rounded-lg bg-sunk" aria-label="正在读取账户" />
          ) : user ? (
            <Link
              href="/account"
              className="flex items-center gap-2 rounded-lg border border-line bg-surface-2 px-2 py-1.5 transition hover:border-accent/40"
              title="收藏、对比清单与对话历史"
            >
              <span className="grid h-7 w-7 flex-none place-items-center rounded-full bg-accent-soft text-[11px] font-semibold text-accent-ink">
                {userLabel(user).slice(0, 1).toUpperCase()}
              </span>
              <span className="min-w-0 leading-tight">
                <span className="block truncate text-[12.5px] font-medium text-ink">
                  {userLabel(user)}
                </span>
                <span className="block truncate text-[10.5px] text-ink-4">{user.email}</span>
              </span>
            </Link>
          ) : (
            <Link
              href="/login"
              className="flex h-9 items-center justify-between rounded-lg border border-line px-2.5 text-[12.5px] text-ink-2 transition hover:bg-sunk"
              title="登录后可保存收藏、对比清单和对话历史"
            >
              <span>登录 / 注册</span>
              <span className="text-ink-4">→</span>
            </Link>
          )}
          <ThemeToggle />
          <button
            type="button"
            onClick={showIntro}
            className="px-1 text-left text-[10.5px] text-ink-4 underline-offset-4 transition hover:text-ink hover:underline"
          >
            重看封面
          </button>
          <p className="px-1 text-[10.5px] leading-relaxed text-ink-4">
            {modelCount != null ? (
              <>
                <span className="font-semibold text-ink-3">{modelCount}</span> 个型号
                {updatedAt ? ` · 更新于 ${updatedAt}` : ""}
              </>
            ) : (
              "尚未生成数据"
            )}
            <br />
            价格逐条核对厂商定价页
          </p>
        </div>
      </aside>

      <header className="sticky top-0 z-40 border-b border-line bg-sidebar/95 backdrop-blur md:hidden">
        <div className="flex h-14 items-center gap-1 px-3">
          <Link href="/" className="mr-1 flex items-center gap-2">
            <Mark />
            <span className="text-[13px] font-semibold tracking-tight">
              模型选型
            </span>
          </Link>
          <nav className="flex flex-1 items-center justify-center gap-0.5 overflow-x-auto" aria-label="主导航">
            {NAV.map((item) => {
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-label={item.label}
                  aria-current={active ? "page" : undefined}
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition ${
                    active
                      ? "bg-accent-soft text-accent-ink"
                      : "text-ink-3 hover:bg-sunk hover:text-ink"
                  }`}
                >
                  <NavIcon name={item.icon} />
                </Link>
              );
            })}
          </nav>
          <ThemeToggle compact />
          <Link
            href={user ? "/account" : "/login"}
            aria-label={user ? "账户" : "登录或注册"}
            title={user ? "账户" : "登录后可保存数据"}
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition ${
              user
                ? "bg-accent-soft text-[11px] font-semibold text-accent-ink"
                : "text-ink-3 hover:bg-sunk hover:text-ink"
            }`}
          >
            {loading ? (
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-ink-4" />
            ) : user ? (
              userLabel(user).slice(0, 1).toUpperCase()
            ) : (
              <AccountIcon />
            )}
          </Link>
        </div>
      </header>
    </>
  );
}

function Brand() {
  return (
    <Link href="/" className="flex items-center gap-2.5 px-1.5 pt-1">
      <Mark />
      <span className="leading-tight">
        <span className="block text-[13.5px] font-semibold tracking-tight">
          模型选型工作台
        </span>
        <span className="mt-0.5 block text-[10.5px] text-ink-4">
          国内大模型 · 可追溯
        </span>
      </span>
    </Link>
  );
}

function Mark() {
  return (
    <span className="grid h-7 w-7 flex-none place-items-center rounded-lg bg-accent text-white">
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <rect x="1.5" y="1.5" width="5.4" height="5.4" rx="1.4" fill="currentColor" />
        <rect x="9.1" y="1.5" width="5.4" height="5.4" rx="1.4" fill="currentColor" opacity=".55" />
        <rect x="1.5" y="9.1" width="5.4" height="5.4" rx="1.4" fill="currentColor" opacity=".55" />
        <rect x="9.1" y="9.1" width="5.4" height="5.4" rx="1.4" fill="currentColor" />
      </svg>
    </span>
  );
}

function NavIcon({
  name,
  className,
}: {
  name: "home" | "board" | "chat" | "calc" | "book";
  className?: string;
}) {
  const cls = className ?? "";
  if (name === "home") {
    return (
      <svg className={cls} width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2.5 7.2 8 2.5l5.5 4.7V13a.8.8 0 0 1-.8.8H3.3a.8.8 0 0 1-.8-.8V7.2Z" />
      </svg>
    );
  }
  if (name === "board") {
    return (
      <svg className={cls} width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
        <path d="M2 13.5h12M4 13.5V9M8 13.5V4.5M12 13.5V7" />
      </svg>
    );
  }
  if (name === "calc") {
    return (
      <svg className={cls} width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
        <rect x="2.2" y="2.2" width="11.6" height="11.6" rx="2.2" />
        <path d="M5.2 5.2h5.6M5.2 8h2.4M9.6 8h1.2M5.2 10.8h2.4M9.6 10.8h1.2" />
      </svg>
    );
  }
  if (name === "chat") {
    return (
      <svg className={cls} width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2.5 4.2A1.7 1.7 0 0 1 4.2 2.5h7.6a1.7 1.7 0 0 1 1.7 1.7v5.6a1.7 1.7 0 0 1-1.7 1.7H7.2L4 13.6v-2.1h-.5a1 1 0 0 1-1-1V4.2Z" />
        <path d="M5.5 5.8h5M5.5 8.2h3.2" />
      </svg>
    );
  }
  return (
    <svg className={cls} width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
      <path d="M3 3.2c1.6-.8 3.4-.8 5 0v9.6c-1.6-.8-3.4-.8-5 0V3.2ZM13 3.2c-1.6-.8-3.4-.8-5 0v9.6c1.6-.8 3.4-.8 5 0V3.2Z" />
    </svg>
  );
}

function AccountIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="8" cy="5.4" r="2.4" />
      <path d="M3.4 13c.5-2.2 2.3-3.4 4.6-3.4s4.1 1.2 4.6 3.4" />
    </svg>
  );
}