import type { Model } from "./types";
import type { Currency } from "./leaderboard";

export type UnitPrice = {
  input: number;
  output: number;
  cacheRead: number | null;
};

// 缺报价返回 null：试算器只对当前币种有价的型号估算，不做换算或补零
export function unitPriceFromModel(model: Model, currency: Currency): UnitPrice | null {
  const price = currency === "CNY" ? model.priceCny : model.priceUsd;
  if (!price) return null;
  return { input: price.input, output: price.output, cacheRead: price.cacheRead };
}

export type CostAssumptions = {
  dailyRequests: number;
  inputTokens: number;
  outputTokens: number;
  cacheHitRate: number;
  retryRate: number;
  outputInflate: number;
  days: number;
};

export const DEFAULT_ASSUMPTIONS: CostAssumptions = {
  dailyRequests: 1000,
  inputTokens: 800,
  outputTokens: 300,
  cacheHitRate: 0,
  retryRate: 0.03,
  outputInflate: 1,
  days: 30,
};

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

export type CostResult = {
  perCall: number;
  daily: number;
  monthly: number;
  cacheApplied: boolean;
};

/**
 * 单价单位为「每百万 token」。缓存命中部分按 cacheRead 计价；
 * 模型无缓存价时忽略命中率，避免给出无法兑现的省钱结论。
 */
export function estimateCost(price: UnitPrice, a: CostAssumptions): CostResult {
  const hit = price.cacheRead == null ? 0 : clamp01(a.cacheHitRate);
  const perM = 1_000_000;

  const inputPerCall =
    (a.inputTokens * ((1 - hit) * price.input + hit * (price.cacheRead ?? price.input))) / perM;
  const outputPerCall = (a.outputTokens * price.output * Math.max(1, a.outputInflate)) / perM;
  const perCall = (inputPerCall + outputPerCall) * (1 + Math.max(0, a.retryRate));

  return {
    perCall,
    daily: perCall * a.dailyRequests,
    monthly: perCall * a.dailyRequests * a.days,
    cacheApplied: price.cacheRead != null && hit > 0,
  };
}

// 单次成本常小于 1 分，固定两位小数会显示成 ¥0.00，必须按量级换精度
export function formatMoney(value: number, currency: Currency): string {
  if (!Number.isFinite(value)) return "—";
  const symbol = currency === "CNY" ? "¥" : "$";
  if (value === 0) return `${symbol}0`;
  const abs = Math.abs(value);
  if (abs >= 1000) {
    return `${symbol}${value.toLocaleString("zh-CN", { maximumFractionDigits: 0 })}`;
  }
  if (abs >= 1) return `${symbol}${value.toFixed(2)}`;
  if (abs >= 0.01) return `${symbol}${value.toFixed(3)}`;
  return `${symbol}${Number(value.toPrecision(2))}`;
}