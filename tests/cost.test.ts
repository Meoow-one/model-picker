import { describe, expect, it } from "vitest";
import {
  DEFAULT_ASSUMPTIONS,
  estimateCost,
  formatMoney,
  unitPriceFromModel,
  type CostAssumptions,
} from "../lib/cost";
import type { Model } from "../lib/types";

const price = { input: 2, output: 8, cacheRead: 0.2 };

const base: CostAssumptions = {
  ...DEFAULT_ASSUMPTIONS,
  dailyRequests: 1000,
  inputTokens: 800,
  outputTokens: 300,
  cacheHitRate: 0,
  retryRate: 0,
  outputInflate: 1,
  days: 30,
};

describe("estimateCost", () => {
  it("按每百万 token 计价", () => {
    const r = estimateCost(price, base);
    // 800*2/1e6 + 300*8/1e6 = 0.0016 + 0.0024
    expect(r.perCall).toBeCloseTo(0.004, 10);
    expect(r.daily).toBeCloseTo(4, 10);
    expect(r.monthly).toBeCloseTo(120, 10);
  });

  it("缓存命中按 cacheRead 计价，且只作用于输入", () => {
    const r = estimateCost(price, { ...base, cacheHitRate: 0.5 });
    // 800*(0.5*2 + 0.5*0.2)/1e6 = 0.00088, + 0.0024
    expect(r.perCall).toBeCloseTo(0.00328, 10);
    expect(r.monthly).toBeCloseTo(98.4, 10);
    expect(r.cacheApplied).toBe(true);
  });

  it("模型无缓存价时忽略命中率，不产生虚假节省", () => {
    const r = estimateCost({ ...price, cacheRead: null }, { ...base, cacheHitRate: 0.9 });
    expect(r.perCall).toBeCloseTo(0.004, 10);
    expect(r.cacheApplied).toBe(false);
  });

  it("重试率与输出膨胀都计入", () => {
    const r = estimateCost(price, { ...base, retryRate: 0.03, outputInflate: 2 });
    // (0.0016 + 0.0048) * 1.03
    expect(r.perCall).toBeCloseTo(0.006592, 10);
  });

  it("通胀系数不允许低于 1", () => {
    const low = estimateCost(price, { ...base, outputInflate: 0.2 });
    expect(low.perCall).toBeCloseTo(0.004, 10);
  });

  it("命中率越界会被裁剪到 1，等于全部命中", () => {
    const r = estimateCost(price, { ...base, cacheHitRate: 3 });
    // 800*0.2/1e6 + 300*8/1e6 = 0.00016 + 0.0024
    expect(r.perCall).toBeCloseTo(0.00256, 10);
  });
});

describe("formatMoney", () => {
  it("按量级换精度，单次成本不显示成 ¥0.00", () => {
    expect(formatMoney(0.004, "CNY")).toBe("¥0.004");
    expect(formatMoney(0.0000123, "CNY")).toBe("¥0.000012");
    expect(formatMoney(0.5, "USD")).toBe("$0.500");
  });

  it("大于 1 保留两位，万元以上用千分位整数", () => {
    expect(formatMoney(120.456, "CNY")).toBe("¥120.46");
    expect(formatMoney(12345.6, "CNY")).toBe("¥12,346");
  });

  it("零、非数字与币种符号", () => {
    expect(formatMoney(0, "CNY")).toBe("¥0");
    expect(formatMoney(Number.NaN, "USD")).toBe("—");
  });
});

describe("unitPriceFromModel", () => {
  const model = {
    priceCny: { input: 1, output: 4, cacheRead: 0.2, currency: "CNY", unit: "per_1m_tokens" },
    priceUsd: null,
  } as unknown as Model;

  it("只取当前币种的价格，不做换算", () => {
    expect(unitPriceFromModel(model, "CNY")).toEqual({ input: 1, output: 4, cacheRead: 0.2 });
    // 缺美元价返回 null，由 UI 显示「无公开报价」而不是按汇率补一个
    expect(unitPriceFromModel(model, "USD")).toBeNull();
  });
});