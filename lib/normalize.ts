/**
 * 名称归一化与模糊匹配。
 * 同一模型在四个源里命名不同（DeepSeek-V4.1-Flash / deepseek/deepseek-v4.1-flash /
 * deepseek-v4-flash / DeepSeek V4.1 Flash 1017），匹配必须是可解释的，
 * 模糊匹配结果只允许进入待确认队列，不允许静默入库。
 */

export function normalizeName(input: string): string {
  const tail = input.includes("/") ? input.slice(input.lastIndexOf("/") + 1) : input;
  return tail
    .toLowerCase()
    .replace(/:(batch|free)$/, "")
    .replace(/[^a-z0-9]/g, "");
}

export type Match<T> = { item: T; score: number; reason: "exact" | "contains" };

export function findBestMatch<T>(
  query: string,
  entries: T[],
  keyOf: (item: T) => string,
  minScore = 0.85,
): Match<T> | null {
  const q = normalizeName(query);
  if (!q) return null;

  let best: Match<T> | null = null;

  for (const item of entries) {
    const key = normalizeName(keyOf(item));
    if (!key) continue;

    let score = 0;
    let reason: Match<T>["reason"] = "contains";

    if (key === q) {
      score = 1;
      reason = "exact";
    } else if (key.includes(q) || q.includes(key)) {
      const shorter = Math.min(key.length, q.length);
      const longer = Math.max(key.length, q.length);
      score = 0.7 + 0.29 * (shorter / longer);
    }

    if (score >= minScore && (!best || score > best.score)) {
      best = { item, score, reason };
    }
  }

  return best;
}