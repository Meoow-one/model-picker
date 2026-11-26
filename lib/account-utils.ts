export type ChatCitation = { id: string; name: string; vendor: string };

type UserLike = {
  email?: string | null;
  user_metadata?: Record<string, unknown> | null;
};

export function userLabel(user: UserLike | null): string {
  const raw = user?.user_metadata?.display_name;
  if (typeof raw === "string" && raw.trim() !== "") return raw.trim();
  const email = user?.email ?? "";
  return email.includes("@") ? email.split("@")[0] : email || "账户";
}

// 登录后的回跳只允许站内路径，避免 ?next= 变成开放重定向
export function safeNext(raw: string | null | undefined, fallback = "/"): string {
  if (!raw || raw.length > 500) return fallback;
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\")) return fallback;
  if (raw.startsWith("/login")) return fallback;
  return raw;
}

export function threadTitle(text: string, max = 40): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return "新的选型对话";
  return clean.length > max ? `${clean.slice(0, max)}…` : clean;
}

export function authErrorMessage(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login credentials")) return "邮箱或密码不正确。";
  if (m.includes("email not confirmed")) return "邮箱还没验证。请点开验证邮件里的链接，再来登录。";
  if (m.includes("user already registered")) return "这个邮箱已经注册，请直接登录。";
  if (m.includes("password should be at least")) return "密码至少 8 个字符。";
  if (m.includes("rate limit") || m.includes("too many requests")) return "操作太频繁，请稍后再试。";
  if (m.includes("signups not allowed") || m.includes("signup is disabled")) return "站点暂未开放注册。";
  if (m.includes("invalid email") || m.includes("unable to validate email")) return "邮箱格式不正确。";
  if (m.includes("fetch") || m.includes("network")) return "无法连接账号服务，请检查网络或 Supabase 配置。";
  return "操作失败，请稍后重试。";
}

export function accountErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error ?? "");
  const m = message.toLowerCase();
  if (m.includes("does not exist") && (m.includes("relation") || m.includes("table"))) {
    return "数据库表还没创建，请先在 Supabase SQL Editor 运行 supabase/schema.sql。";
  }
  if (m.includes("row-level security") || m.includes("permission denied")) {
    return "没有权限读写这条数据，请重新登录后再试。";
  }
  if (m.includes("jwt") || m.includes("not authenticated") || message === "请先登录") {
    return "登录已过期，请重新登录。";
  }
  if (m.includes("failed to fetch") || m.includes("network")) {
    return "无法连接账号服务，请检查网络或 Supabase 配置。";
  }
  if (message.startsWith("账号服务") || message.startsWith("这条对话") || message.startsWith("至少选择")) {
    return message;
  }
  return "账户数据操作失败，请稍后重试。";
}

export function parseCitations(value: unknown): ChatCitation[] {
  if (!Array.isArray(value)) return [];
  const out: ChatCitation[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    if (typeof row.id !== "string" || typeof row.name !== "string") continue;
    out.push({
      id: row.id,
      name: row.name,
      vendor: typeof row.vendor === "string" ? row.vendor : "",
    });
  }
  return out;
}