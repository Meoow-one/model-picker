"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useAuth } from "@/components/auth/AuthProvider";
import { safeNext } from "@/lib/account-utils";

type Props = {
  open: boolean;
  onClose: () => void;
  feature: string;
  nextPath?: string;
};

export default function LoginGate({ open, onClose, feature, nextPath }: Props) {
  const { configured } = useAuth();

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const current =
    typeof window === "undefined" ? "/" : window.location.pathname + window.location.search;
  const target = safeNext(nextPath ?? current);
  const loginHref = `/login?next=${encodeURIComponent(target)}`;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="login-gate-title"
      className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-[#081120]/55 p-4 backdrop-blur-[2px] sm:p-8"
      onClick={onClose}
    >
      <div className="card w-full max-w-sm p-5 shadow-float" onClick={(event) => event.stopPropagation()}>
        <h2 id="login-gate-title" className="text-lg font-semibold">
          {configured ? "登录后保存这次选择" : "账号服务还没连接"}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-ink-3">
          {configured
            ? `「${feature}」会保存到你的账号，换一台设备登录也能看到。浏览榜单和试算成本不需要登录。`
            : "收藏、对比清单和对话历史需要 Supabase 账号库。配置步骤在登录页里。"}
        </p>

        <ul className="mt-3 space-y-1.5 text-[13px] text-ink-3">
          <li>· 收藏型号，回到账户页随时查看</li>
          <li>· 保存对比清单，下次直接打开</li>
          <li>· 保存顾问对话历史</li>
        </ul>

        <p className="mt-3 rounded-lg bg-sunk px-3 py-2 text-[11px] leading-relaxed text-ink-4">
          账号与对话 API Key 是两回事：登录只用于保存数据；模型的 API Key 仍然只保存在本浏览器。
        </p>

        <div className="mt-5 flex items-center justify-end gap-2">
          <button type="button" onClick={onClose} className="btn-ghost h-9 px-3.5">
            稍后
          </button>
          <Link href={loginHref} className="btn-primary h-9 px-4 text-[13px]">
            {configured ? "去登录 / 注册" : "查看配置步骤"}
          </Link>
        </div>
      </div>
    </div>
  );
}