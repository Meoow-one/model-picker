import { describe, expect, it } from "vitest";
import type { Model } from "../lib/types";
import {
  DEFAULT_BASE_URL,
  citationsFor,
  normalizeBaseUrl,
  runTool,
} from "../lib/assistant";

function makeModel(overrides: Partial<Model> & { id: string }): Model {
  return {
    name: overrides.id,
    vendor: "alibaba",
    contextWindow: 32_000,
    maxOutput: 8_000,
    releaseDate: "2026-01-01",
    knowledgeCutoff: null,
    openWeights: false,
    capabilities: {
      reasoning: false,
      toolCall: true,
      structuredOutput: true,
      vision: false,
      cache: true,
    },
    priceUsd: null,
    priceCny: null,
    scores: [],
    sources: [],
    ...overrides,
  };
}

const cheap = makeModel({
  id: "cheap",
  contextWindow: 32_000,
  priceCny: {
    input: 0.5,
    output: 2,
    cacheRead: 0.1,
    currency: "CNY",
    unit: "per_1m_tokens",
    sourceUrl: "https://example.com",
    verifiedAt: "2026-11-25",
    status: "verified",
  },
});

const pricey = makeModel({
  id: "pricey",
  vendor: "deepseek",
  contextWindow: 1_000_000,
  openWeights: true,
  priceCny: {
    input: 10,
    output: 30,
    cacheRead: null,
    currency: "CNY",
    unit: "per_1m_tokens",
    sourceUrl: "https://example.com",
    verifiedAt: "2026-11-25",
    status: "reported",
  },
  scores: [
    {
      benchmark: "opencompass_overall",
      score: 80,
      source: "司南",
      sourceUrl: "",
      asOf: "2026-11-20",
    },
  ],
});

const unpriced = makeModel({
  id: "unpriced",
  vendor: "zhipu",
  contextWindow: 256_000,
  capabilities: {
    reasoning: false,
    toolCall: false,
    structuredOutput: false,
    vision: true,
    cache: false,
  },
});

const models = [cheap, pricey, unpriced];

type SearchResult = {
  totalMatched: number;
  returned: number;
  notice?: string;
  models: { id: string; price: unknown }[];
};

function search(args: Record<string, unknown>): SearchResult {
  return runTool("search_models", args, models).result as SearchResult;
}

describe("search_models 工具", () => {
  it("按厂商与能力过滤，并按输入价升序返回", () => {
    const outcome = runTool("search_models", { vendors: ["deepseek"] }, models);
    expect((outcome.result as SearchResult).models.map((m) => m.id)).toEqual(["pricey"]);
    expect(outcome.citedIds).toEqual(["pricey"]);

    const capped = search({ caps: ["toolCall", "cache"] });
    expect(capped.models.map((m) => m.id)).toEqual(["cheap", "pricey"]);
  });

  it("支持模糊搜索型号名，且缺价型号排在后面", () => {
    const result = search({ query: "deepsek" });
    expect(result.models.map((m) => m.id)).toEqual(["pricey"]);

    const all = search({});
    expect(all.models.map((m) => m.id)).toEqual(["cheap", "pricey", "unpriced"]);
  });

  it("币种与价格上限按当前币种判断", () => {
    expect(search({ maxInput: 1, currency: "CNY" }).models.map((m) => m.id)).toEqual(["cheap"]);
    expect(search({ maxInput: 1, currency: "USD" }).models).toEqual([]);
  });

  it("无结果时明确提示，不让模型自己补数据", () => {
    const result = search({ vendors: ["openai"] });
    expect(result.totalMatched).toBe(0);
    expect(result.notice).toContain("不要编造");
  });

  it("参数不合法时返回错误而不是抛异常", () => {
    const result = search({ limit: 999 });
    expect((result as { error?: string }).error).toBe("参数不合法");
  });
});

describe("estimate_cost 工具", () => {
  it("用站内单价计算月成本，并返回格式化文本", () => {
    const outcome = runTool(
      "estimate_cost",
      {
        modelIds: ["cheap"],
        dailyRequests: 1000,
        inputTokens: 1000,
        outputTokens: 500,
        retryRate: 0,
        cacheHitRate: 0,
        outputInflate: 1,
        days: 30,
      },
      models,
    );
    const result = outcome.result as {
      models: { monthly: number; monthlyText: string; perCall: number }[];
      missing: string[];
    };
    // (1000 * 0.5 + 500 * 2) / 1e6 * 1000 * 30 = 45
    expect(result.models[0].monthly).toBeCloseTo(45);
    expect(result.models[0].perCall).toBeCloseTo(0.0015);
    expect(result.models[0].monthlyText).toBe("¥45.00");
    expect(result.missing).toEqual([]);
  });

  it("该币种缺价的型号单独列出，不按 0 计算", () => {
    const outcome = runTool(
      "estimate_cost",
      { modelIds: ["cheap", "unpriced", "unknown"], currency: "USD" },
      models,
    );
    const result = outcome.result as { models: unknown[]; missing: string[]; notice?: string };
    expect(result.models).toEqual([]);
    expect(result.missing).toEqual(["cheap", "unpriced", "unknown"]);
    expect(result.notice).toContain("不能当作 0");
    expect(outcome.citedIds).toEqual([]);
  });
});

describe("compare_models 工具", () => {
  it("对齐字段并标出未收录型号", () => {
    const outcome = runTool(
      "compare_models",
      { modelIds: ["cheap", "unpriced", "missing"], currency: "CNY" },
      models,
    );
    const result = outcome.result as {
      models: { id: string; priceCny: unknown; priceUsd: unknown }[];
      missing: string[];
      notice?: string;
    };
    expect(result.models.map((m) => m.id)).toEqual(["cheap", "unpriced"]);
    expect(result.models[1].priceCny).toBeNull();
    expect(result.models[0].priceUsd).toBeNull();
    expect(result.missing).toEqual(["missing"]);
    expect(result.notice).toContain("不要为它们编造参数");
    expect(outcome.citedIds).toEqual(["cheap", "unpriced"]);
  });

  it("少于两个型号时拒绝执行", () => {
    const result = runTool("compare_models", { modelIds: ["cheap"] }, models).result as {
      error?: string;
    };
    expect(result.error).toBe("参数不合法");
  });
});

it("未知工具返回可用工具列表", () => {
  const result = runTool("get_secret_data", {}, models).result as { error?: string };
  expect(result.error).toContain("search_models");
});

describe("引用与端点校验", () => {
  it("引用去重、跳过未收录，最多 6 个", () => {
    const many = Array.from({ length: 8 }, (_, i) => makeModel({ id: `m${i}`, name: `模型 ${i}` }));
    const list = citationsFor(["m0", "m1", "m0", "unknown", "m2", "m3", "m4", "m5", "m6"], many);
    expect(list.map((c) => c.id)).toEqual(["m0", "m1", "m2", "m3", "m4", "m5"]);
  });

  it("端点只接受 https 公网域名", () => {
    expect(normalizeBaseUrl("")).toBe(DEFAULT_BASE_URL);
    expect(normalizeBaseUrl("  ")).toBe(DEFAULT_BASE_URL);
    expect(normalizeBaseUrl("https://api.moonshot.cn/v1/")).toBe("https://api.moonshot.cn/v1");
    expect(normalizeBaseUrl("http://api.deepseek.com")).toBeNull();
    expect(normalizeBaseUrl("https://localhost:3000")).toBeNull();
    expect(normalizeBaseUrl("https://127.0.0.1")).toBeNull();
    expect(normalizeBaseUrl("https://user:pass@api.example.com")).toBeNull();
    expect(normalizeBaseUrl("not a url")).toBeNull();
  });
});