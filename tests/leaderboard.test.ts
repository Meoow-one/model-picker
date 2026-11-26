import { describe, expect, it } from "vitest";
import type { Model } from "../lib/types";
import {
  DEFAULT_FILTERS,
  filterModels,
  formatContext,
  formatPrice,
  formatScore,
  getBoardSpec,
  resolveBoard,
  sortModels,
} from "../lib/leaderboard";

function makeModel(overrides: Partial<Model> & { id: string }): Model {
  return {
    name: overrides.id,
    vendor: "alibaba",
    contextWindow: 128_000,
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
    cacheRead: null,
    currency: "CNY",
    unit: "per_1m_tokens",
    sourceUrl: "https://example.com",
    verifiedAt: "2026-11-25",
    status: "verified",
  },
  scores: [
    {
      benchmark: "aa_intelligence",
      score: 40,
      source: "AA",
      sourceUrl: "https://example.com",
      asOf: "2026-11-25",
    },
  ],
});

const pricey = makeModel({
  id: "pricey",
  vendor: "deepseek",
  contextWindow: 1_000_000,
  openWeights: true,
  priceCny: {
    input: 10,
    output: 30,
    cacheRead: 1,
    currency: "CNY",
    unit: "per_1m_tokens",
    sourceUrl: "https://example.com",
    verifiedAt: "2026-11-25",
    status: "reported",
  },
  scores: [
    {
      benchmark: "aa_intelligence",
      score: 60,
      source: "AA",
      sourceUrl: "https://example.com",
      asOf: "2026-11-25",
    },
  ],
});

const unscored = makeModel({
  id: "unscored",
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

const models = [cheap, pricey, unscored];

function board(id: Parameters<typeof getBoardSpec>[0], pool: Model[] = models) {
  return resolveBoard(getBoardSpec(id), pool);
}

describe("filterModels", () => {
  it("按厂商与上下文过滤", () => {
    const result = filterModels(models, {
      ...DEFAULT_FILTERS,
      vendors: ["deepseek"],
      minContext: 200_000,
    });
    expect(result.map((m) => m.id)).toEqual(["pricey"]);
  });

  it("按能力开关过滤，多个条件是 AND", () => {
    const result = filterModels(models, {
      ...DEFAULT_FILTERS,
      caps: ["toolCall", "cache"],
    });
    expect(result.map((m) => m.id)).toEqual(["cheap", "pricey"]);
  });

  it("价格上限按当前币种判断，缺价直接排除", () => {
    expect(
      filterModels(models, { ...DEFAULT_FILTERS, maxInput: 1 }).map((m) => m.id),
    ).toEqual(["cheap"]);
    expect(
      filterModels(models, { ...DEFAULT_FILTERS, maxInput: 1, currency: "USD" }),
    ).toEqual([]);
  });

  it("国际参照默认不出现，显式开启后才进入榜单", () => {
    const foreign = makeModel({ id: "gpt", vendor: "openai" });
    const all = [...models, foreign];
    expect(filterModels(all, DEFAULT_FILTERS).map((m) => m.id)).not.toContain("gpt");
    expect(
      filterModels(all, { ...DEFAULT_FILTERS, includeForeign: true }).map((m) => m.id),
    ).toContain("gpt");
  });
});

describe("sortModels", () => {
  it("综合榜按分数降序，无分置底", () => {
    const result = sortModels(models, board("overall"), "CNY", null);
    expect(result.map((m) => m.id)).toEqual(["pricey", "cheap", "unscored"]);
  });

  it("高速低价榜按输入价升序，缺价置底", () => {
    const result = sortModels(models, board("cheap"), "CNY", null);
    expect(result.map((m) => m.id)).toEqual(["cheap", "pricey", "unscored"]);
  });

  it("手动指定排序覆盖子榜默认方向", () => {
    const result = sortModels(models, board("overall"), "CNY", {
      key: "input",
      dir: "desc",
    });
    expect(result.map((m) => m.id)).toEqual(["pricey", "cheap", "unscored"]);
  });

  it("性价比 = 综合分 ÷ 输入价，缺分或免费不参与", () => {
    const value = board("value");
    expect(value.score(cheap, "CNY")).toBeCloseTo(80);
    expect(value.score(pricey, "CNY")).toBeCloseTo(6);
    expect(value.score(unscored, "CNY")).toBeNull();
  });

  it("性价比榜不展示没有指标的型号", () => {
    const result = sortModels(models, board("value"), "CNY", null);
    expect(result.map((m) => m.id)).toEqual(["cheap", "pricey"]);
  });
});

describe("resolveBoard：有专属指标就切换，没有就退回兜底", () => {
  it("没有 SWE-bench 数据时代码榜退回综合分，并标记为兜底", () => {
    const code = board("code");
    expect(code.activeBenchmark).toBeNull();
    expect(code.scoreLabel).toBe("综合分※");
    expect(code.banner).toContain("尚未接入");
    expect(code.onlyRanked).toBeFalsy();
  });

  it("录入 SWE-bench 后代码榜自动切换指标，且只保留有分的型号", () => {
    const withSwe = [
      makeModel({
        id: "a",
        scores: [
          {
            benchmark: "swe_bench_verified",
            score: 72.4,
            source: "官方技术报告",
            sourceUrl: "",
            asOf: "2026-11-20",
          },
        ],
      }),
      makeModel({ id: "b" }),
    ];
    const code = board("code", withSwe);
    expect(code.activeBenchmark).toBe("swe_bench_verified");
    expect(code.scoreLabel).toBe("代码分 (%)");
    expect(code.onlyRanked).toBe(true);
    expect(code.score(withSwe[0], "CNY")).toBeCloseTo(72.4);
    expect(sortModels(withSwe, code, "CNY", null).map((m) => m.id)).toEqual(["a"]);
  });

  it("综合榜优先用司南综合分，性价比必须跟随同一指标而不是 AA 分", () => {
    const dual = makeModel({
      id: "dual",
      priceCny: {
        input: 10,
        output: 30,
        cacheRead: null,
        currency: "CNY",
        unit: "per_1m_tokens",
        sourceUrl: "https://example.com",
        verifiedAt: "2026-11-25",
        status: "verified",
      },
      scores: [
        {
          benchmark: "aa_intelligence",
          score: 40,
          source: "AA",
          sourceUrl: "",
          asOf: "2026-11-25",
        },
        {
          benchmark: "opencompass_overall",
          score: 80,
          source: "司南",
          sourceUrl: "",
          asOf: "2026-11-20",
        },
      ],
    });
    const overall = board("overall", [dual]);
    expect(overall.activeBenchmark).toBe("opencompass_overall");
    expect(overall.scoreLabel).toBe("综合分");
    const value = board("value", [dual]);
    // 80 / 10；若误用 aa_intelligence 会得到 4
    expect(value.score(dual, "CNY")).toBeCloseTo(8);
  });

  it("只有智能体数据时代码榜用「智能体分」，并说明它不是纯代码分", () => {
    const agentic = makeModel({
      id: "agentic",
      scores: [
        {
          benchmark: "opencompass_agentic",
          score: 55,
          source: "司南",
          sourceUrl: "",
          asOf: "2026-11-20",
        },
      ],
    });
    const code = board("code", [agentic, makeModel({ id: "no-score" })]);
    expect(code.activeBenchmark).toBe("opencompass_agentic");
    expect(code.scoreLabel).toBe("智能体分");
    expect(code.banner).toContain("不是纯代码");
    expect(code.onlyRanked).toBe(true);
  });

  it("写作榜不拿 SuperCLUE 总榜顶替，宁可走兜底", () => {
    const sc = makeModel({
      id: "sc",
      scores: [
        {
          benchmark: "superclue_overall",
          score: 60,
          source: "SuperCLUE",
          sourceUrl: "",
          asOf: "2026-11",
        },
      ],
    });
    const writing = board("writing", [sc]);
    expect(writing.activeBenchmark).toBeNull();
    expect(writing.scoreLabel).toBe("综合分※");
  });

  it("延迟榜是越低越好，走专属指标时按 asc 排序", () => {
    const withLatency = [
      makeModel({
        id: "fast",
        scores: [
          { benchmark: "ttft_ms", score: 180, source: "官方", sourceUrl: "", asOf: "2026-11-20" },
        ],
      }),
      makeModel({
        id: "slow",
        scores: [
          { benchmark: "ttft_ms", score: 900, source: "官方", sourceUrl: "", asOf: "2026-11-20" },
        ],
      }),
    ];
    const cheapBoard = board("cheap", withLatency);
    expect(cheapBoard.dir).toBe("asc");
    expect(cheapBoard.format).toBe("integer");
    expect(sortModels(withLatency, cheapBoard, "CNY", null).map((m) => m.id)).toEqual([
      "fast",
      "slow",
    ]);
  });
});

describe("格式化", () => {
  it("上下文按 K/M 展示", () => {
    expect(formatContext(128_000)).toBe("125K");
    expect(formatContext(1_048_576)).toBe("1M");
    expect(formatContext(0)).toBe("—");
  });

  it("价格按币种加符号，零价显示免费", () => {
    expect(formatPrice(0.8, "CNY")).toBe("¥0.8");
    expect(formatPrice(163, "CNY")).toBe("¥163");
    expect(formatPrice(0, "CNY")).toBe("免费");
    expect(formatPrice(null, "CNY")).toBe("—");
  });

  it("分数按指标精度展示", () => {
    expect(formatScore(72.44, "decimal")).toBe("72.4");
    expect(formatScore(180.6, "integer")).toBe("181");
    expect(formatScore(null, "decimal")).toBe("—");
  });
});