"use client";

import Link from "next/link";
import { useAuth } from "@/components/auth/AuthProvider";
import { userLabel } from "@/lib/account-utils";

export default function AccountLink({ className = "" }: { className?: string }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <span className={`text-ink-4 ${className}`}>账户加载中…</span>;
  }

  return (
    <Link
      href={user ? "/account" : "/login"}
      className={`underline decoration-line underline-offset-2 transition hover:text-ink ${className}`}
      title={user ? "查看收藏、对比清单和对话历史" : "登录后可保存收藏、对比清单和对话历史"}
    >
      {user ? `账户 · ${userLabel(user)}` : "登录 / 注册"}
    </Link>
  );
}