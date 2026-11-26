"use client";

import { useEffect, useState } from "react";

type Mode = "system" | "light" | "dark";

const STORAGE_KEY = "mp-theme";
const SWITCH_CLASS = "theme-switch";

const OPTIONS: { value: Mode; label: string; icon: "monitor" | "sun" | "moon" }[] = [
  { value: "system", label: "自动", icon: "monitor" },
  { value: "light", label: "浅色", icon: "sun" },
  { value: "dark", label: "深色", icon: "moon" },
];

function resolve(mode: Mode): "light" | "dark" {
  if (mode !== "system") return mode;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

// 先关掉全局过渡再换变量，否则 var 驱动的颜色会卡在旧值
function setTheme(mode: Mode) {
  const root = document.documentElement;
  root.classList.add(SWITCH_CLASS);
  root.dataset.theme = resolve(mode);
  void root.offsetHeight;
  requestAnimationFrame(() => {
    requestAnimationFrame(() => root.classList.remove(SWITCH_CLASS));
  });
  window.setTimeout(() => root.classList.remove(SWITCH_CLASS), 250);
}

export default function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const [mode, setMode] = useState<Mode>("system");

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as Mode | null;
    const initial: Mode = stored === "light" || stored === "dark" ? stored : "system";
    setMode(initial);
    document.documentElement.dataset.theme = resolve(initial);
  }, []);

  useEffect(() => {
    if (mode !== "system") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => setTheme("system");
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [mode]);

  function apply(next: Mode) {
    setMode(next);
    localStorage.setItem(STORAGE_KEY, next);
    setTheme(next);
  }

  return (
    <div
      className="flex gap-0.5 rounded-full border border-line bg-surface-2 p-0.5"
      role="group"
      aria-label="主题"
    >
      {OPTIONS.map((option) => {
        const active = mode === option.value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => apply(option.value)}
            aria-pressed={active}
            aria-label={option.label}
            title={option.label}
            className={`flex h-7 flex-1 items-center justify-center gap-1.5 rounded-full text-[11px] transition ${
              active
                ? "bg-surface font-semibold text-ink shadow-card"
                : "text-ink-4 hover:text-ink"
            }`}
          >
            <Icon name={option.icon} />
            {!compact && <span>{option.label}</span>}
          </button>
        );
      })}
    </div>
  );
}

function Icon({ name }: { name: "monitor" | "sun" | "moon" }) {
  if (name === "monitor") {
    return (
      <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
        <rect x="2" y="3" width="12" height="8" rx="1.5" />
        <path d="M5.5 13.5h5M8 11v2.5" />
      </svg>
    );
  }
  if (name === "sun") {
    return (
      <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
        <circle cx="8" cy="8" r="3" />
        <path d="M8 1.2v1.6M8 13.2v1.6M1.2 8h1.6M13.2 8h1.6M3.2 3.2l1.1 1.1M11.7 11.7l1.1 1.1M12.8 3.2l-1.1 1.1M4.3 11.7l-1.1 1.1" />
      </svg>
    );
  }
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
      <path d="M13.2 9.8A5.5 5.5 0 0 1 6.2 2.8a5.6 5.6 0 1 0 7 7Z" />
    </svg>
  );
}