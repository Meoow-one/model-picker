import { describe, expect, it } from "vitest";
import { fuzzyIncludes, matchesSearch, normalizeSearch, searchParts } from "../lib/search";
import { filterModels, DEFAULT_FILTERS } from "../lib/leaderboard";
import type { Model } from "../lib/types";

const QUERY_FIELDS = ["Qwen3.8 Flash", "qwen3.8-flash", "阿里", "alibaba"];

describe("normalizeSearch", () => {
  it("忽略大小写、空格、标点与全角字符", () => {
    expect(normalizeSearch(" QWEN 3.8-Flash ")).toBe("qwen38flash");
    expect(normalizeSearch("Ｑｗｅｎ３.８")).toBe("qwen38");
  });
});

describe("searchParts", () => {
  it("按空白和常见分隔符拆词后归一化", () => {
    expect(searchParts(" Qwen 3.8 Flash ")).toEqual(["qwen", "3", "8", "flash"]);
    expect(searchParts("glm-5.3")).toEqual(["glm", "5", "3"]);
    expect(searchParts("   ")).toEqual([]);
  });
});

describe("fuzzyIncludes", () => {
  it("允许单个字符的缺漏或错写", () => {
    expect(fuzzyIncludes("qwen38flash", "qwen38flsh")).toBe(true);
    expect(fuzzyIncludes("qwen38flash", "qwen39flash")).toBe(true);
    expect(fuzzyIncludes("qwen38flash", "qwn38flash")).toBe(true);
    expect(fuzzyIncludes("deepseek", "deepsek")).toBe(true);
  });

  it("两个以上错误不匹配", () => {
    expect(fuzzyIncludes("qwen38flash", "qwn38flsh")).toBe(false);
  });

  it("短查询不做容错，只做包含", () => {
    expect(fuzzyIncludes("glm53", "glm")).toBe(true);
    expect(fuzzyIncludes("glm53", "gm")).toBe(false);
  });
});

describe("matchesSearch", () => {
  it("大小写混写、空格缺失、中英厂商都能命中", () => {
    expect(matchesSearch("qWeN3.8FLASH", QUERY_FIELDS)).toBe(true);
    expect(matchesSearch("qwen 3.8 flash", QUERY_FIELDS)).toBe(true);
    expect(matchesSearch("qwen3.9 flash", QUERY_FIELDS)).toBe(true);
    expect(matchesSearch("qwen38flsh", QUERY_FIELDS)).toBe(true);
    expect(matchesSearch("ALI BABA", QUERY_FIELDS)).toBe(true);
    expect(matchesSearch("阿里", QUERY_FIELDS)).toBe(true);
  });

  it("中文厂商允许一个字错写", () => {
    expect(matchesSearch("月暗面", ["月之暗面"])).toBe(true);
  });

  it("多词必须全部命中", () => {
    expect(matchesSearch("qwen flash", QUERY_FIELDS)).toBe(true);
    expect(matchesSearch("qwen glm", QUERY_FIELDS)).toBe(false);
  });

  it("空查询视为不过滤", () => {
    expect(matchesSearch("   ", QUERY_FIELDS)).toBe(true);
  });
});

function makeModel(overrides: Partial<Model> & { id: string; name: string }): Model {
  return {
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

const dataset = [
  makeModel({ id: "qwen3.8-flash", name: "Qwen3.8 Flash" }),
  makeModel({ id: "deepseek-v4.1-flash", name: "DeepSeek V4.1 Flash", vendor: "deepseek" }),
  makeModel({ id: "glm-5.3", name: "GLM-5.3", vendor: "zhipu" }),
];

describe("filterModels 搜索", () => {
  const search = (query: string) =>
    filterModels(dataset, { ...DEFAULT_FILTERS, query }).map((m) => m.id);

  it("空格缺失与大小写混写", () => {
    expect(search("qwen3.8flash")).toEqual(["qwen3.8-flash"]);
    expect(search("QWEN 3.8")).toEqual(["qwen3.8-flash"]);
  });

  it("单个字母缺漏或打错", () => {
    expect(search("qwen 3.8 flsh")).toEqual(["qwen3.8-flash"]);
    expect(search("qwen 3.9 flash")).toEqual(["qwen3.8-flash"]);
    expect(search("deepsek")).toEqual(["deepseek-v4.1-flash"]);
  });

  it("按厂商中英文搜索", () => {
    expect(search("阿里")).toEqual(["qwen3.8-flash"]);
    expect(search("zhipu")).toEqual(["glm-5.3"]);
  });

  it("不相关查询返回空", () => {
    expect(search("gpt")).toEqual([]);
  });

  it("精确命中优先，不把同系列近似型号一起列出", () => {
    const siblings = [
      makeModel({ id: "qwen3.8-flash", name: "Qwen3.8 Flash" }),
      makeModel({ id: "qwen3.5-flash", name: "Qwen3.5 Flash" }),
    ];
    const hit = (query: string) =>
      filterModels(siblings, { ...DEFAULT_FILTERS, query }).map((m) => m.id);

    expect(hit("qwen3.8flash")).toEqual(["qwen3.8-flash"]);
    expect(hit("qwen 3.8")).toEqual(["qwen3.8-flash"]);
    // 没有精确命中时才容错，3.9 会把兄弟型号一起作为近似结果
    expect(hit("qwen 3.9 flash").sort()).toEqual(["qwen3.5-flash", "qwen3.8-flash"]);
  });
});