import { z } from "zod";
import type { Model } from "./types";
import {
  DEFAULT_FILTERS,
  filterModels,
  priceIn,
  vendorLabel,
  type CapKey,
  type Filters,
} from "./leaderboard";
import {
  DEFAULT_ASSUMPTIONS,
  estimateCost,
  formatMoney,
  unitPriceFromModel,
} from "./cost";

export const DEFAULT_BASE_URL = "https://api.deepseek.com";
export const DEFAULT_MODEL = "deepseek-chat";
export const MAX_OUTPUT_TOKENS = 800;
export const MAX_TOOL_ROUNDS = 3;

export const SYSTEM_PROMPT = `你是「模型选型工作台」的选型顾问，服务对象是 AI 产品经理。站内收录了国内主流大模型和少量国际参照，所有数据以工具返回为准。

硬性规则：
1. 价格、上下文长度、评测分、能力开关只能来自工具结果。禁止凭训练记忆补数字，禁止估算，禁止做人民币与美元换算。
2. 站内没有的模型，直接说「站内未收录，无法给出站内依据」，可以建议用户去厂商官方文档核实，不要编造。
3. 每条涉及数字的结论都要说明口径：币种、每百万 token、评测名称和日期。提醒用户点回答下方的引用卡片核对。
4. 缺价就是「该币种未收录报价」，不能当作 0，也不能用汇率补。
5. 不同评测的口径不同，分数不能相加、不能互相换算；不要断言某模型绝对最优。
6. 建议最多 3 个候选，说明取舍和适用场景，最终决定由用户确认。成本问题必须调用 estimate_cost，不要手算。
7. 用简洁中文回答，纯文本，可用短横线列表。不要输出 Markdown 表格、代码块或加粗标记。
8. 需要站内数据时先调用工具，最多 3 轮。工具没有返回的信息就明确说没有。`;

type ToolCitation = { id: string; name: string; vendor: string };

export type ToolOutcome = {
  result: unknown;
  citedIds: string[];
};

const TOOL_SCHEMAS = {
  search_models: z.object({
    query: z.string().max(80).optional(),
    vendors: z.array(z.string().max(40)).max(10).optional(),
    openWeights: z.boolean().optional(),
    minContext: z.number().int().nonnegative().optional(),
    maxInput: z.number().nonnegative().optional(),
    caps: z
      .array(z.enum(["toolCall", "reasoning", "vision", "cache"]))
      .max(4)
      .optional(),
    currency: z.enum(["CNY", "USD"]).optional(),
    includeForeign: z.boolean().optional(),
    limit: z.number().int().min(1).max(12).optional(),
  }),
  estimate_cost: z.object({
    modelIds: z.array(z.string().min(1)).min(1).max(4),
    currency: z.enum(["CNY", "USD"]).optional(),
    dailyRequests: z.number().positive().optional(),
    inputTokens: z.number().positive().optional(),
    outputTokens: z.number().positive().optional(),
    cacheHitRate: z.number().min(0).max(1).optional(),
    retryRate: z.number().min(0).max(1).optional(),
    outputInflate: z.number().min(1).max(5).optional(),
    days: z.number().int().min(1).max(365).optional(),
  }),
  compare_models: z.object({
    modelIds: z.array(z.string().min(1)).min(2).max(4),
    currency: z.enum(["CNY", "USD"]).optional(),
  }),
};

export const TOOL_DEFINITIONS = [
  {
    type: "function" as const,
    function: {
      name: "search_models",
      description:
        "按条件检索站内模型，返回上下文、能力、人民币/美元价格和已有评测分。价格单位为每百万 token。",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "型号或厂商关键词，支持模糊匹配" },
          vendors: {
            type: "array",
            items: { type: "string" },
            description: "厂商 id，如 alibaba、deepseek、zhipu、moonshot",
          },
          openWeights: { type: "boolean", description: "true 仅开源权重，false 仅闭源" },
          minContext: { type: "number", description: "最小上下文 token 数" },
          maxInput: { type: "number", description: "输入单价上限（每百万 token）" },
          caps: {
            type: "array",
            items: { type: "string", enum: ["toolCall", "reasoning", "vision", "cache"] },
            description: "必须具备的能力，多个条件同时满足",
          },
          currency: { type: "string", enum: ["CNY", "USD"], description: "价格展示币种" },
          includeForeign: {
            type: "boolean",
            description: "是否包含 OpenAI/Anthropic/Google 国际参照，默认包含",
          },
          limit: { type: "number", description: "最多返回条数，默认 8，上限 12" },
        },
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "estimate_cost",
      description:
        "用站内单价和用户业务量估算每个模型的单次、每日、每月成本。禁止手算替代本工具。",
      parameters: {
        type: "object",
        properties: {
          modelIds: {
            type: "array",
            items: { type: "string" },
            description: "站内模型 id，1–4 个",
          },
          currency: { type: "string", enum: ["CNY", "USD"] },
          dailyRequests: { type: "number", description: "日均请求数，默认 1000" },
          inputTokens: { type: "number", description: "每次请求输入 token，默认 800" },
          outputTokens: { type: "number", description: "每次请求输出 token，默认 300" },
          cacheHitRate: { type: "number", description: "输入缓存命中率 0–1，默认 0" },
          retryRate: { type: "number", description: "重试率 0–1，默认 0.03" },
          outputInflate: { type: "number", description: "输出膨胀系数，默认 1" },
          days: { type: "number", description: "计费天数，默认 30" },
        },
        required: ["modelIds"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "compare_models",
      description:
        "对比 2–4 个站内模型的上下文、能力、双币种价格和已有评测分。缺数据的字段为 null。",
      parameters: {
        type: "object",
        properties: {
          modelIds: { type: "array", items: { type: "string" }, description: "站内模型 id，2–4 个" },
          currency: { type: "string", enum: ["CNY", "USD"] },
        },
        required: ["modelIds"],
      },
    },
  },
];

function priceBlock(model: Model, currency: "CNY" | "USD") {
  const price = priceIn(model, currency);
  if (!price) return null;
  return {
    currency,
    input: price.input,
    output: price.output,
    cacheRead: price.cacheRead,
    status: price.status,
    verifiedAt: price.verifiedAt,
  };
}

function compactModel(model: Model, currency: "CNY" | "USD") {
  return {
    id: model.id,
    name: model.name,
    vendor: vendorLabel(model.vendor),
    openWeights: model.openWeights,
    contextWindow: model.contextWindow,
    maxOutput: model.maxOutput,
    capabilities: model.capabilities,
    price: priceBlock(model, currency),
    priceCny: priceBlock(model, "CNY"),
    priceUsd: priceBlock(model, "USD"),
    scores: model.scores.map((score) => ({
      benchmark: score.benchmark,
      score: score.score,
      source: score.source,
      asOf: score.asOf,
    })),
  };
}

function byInputPrice(currency: "CNY" | "USD") {
  return (a: Model, b: Model) => {
    const av = priceIn(a, currency)?.input;
    const bv = priceIn(b, currency)?.input;
    if (av == null && bv == null) return a.name.localeCompare(b.name);
    if (av == null) return 1;
    if (bv == null) return -1;
    return av - bv;
  };
}

function searchModels(raw: unknown, models: Model[]): ToolOutcome {
  const parsed = TOOL_SCHEMAS.search_models.safeParse(raw ?? {});
  if (!parsed.success) {
    return { result: { error: "参数不合法", detail: parsed.error.issues[0]?.message }, citedIds: [] };
  }
  const args = parsed.data;
  const currency = args.currency ?? "CNY";
  const filters: Filters = {
    ...DEFAULT_FILTERS,
    query: args.query ?? "",
    vendors: args.vendors ?? [],
    weights:
      args.openWeights === true ? "open" : args.openWeights === false ? "closed" : "all",
    minContext: args.minContext ?? 0,
    maxInput: args.maxInput ?? null,
    caps: (args.caps ?? []) as CapKey[],
    currency,
    includeForeign: args.includeForeign ?? true,
  };
  const matched = filterModels(models, filters).sort(byInputPrice(currency));
  const limit = args.limit ?? 8;
  const rows = matched.slice(0, limit);

  return {
    result: {
      totalMatched: matched.length,
      returned: rows.length,
      currency,
      // 返回空列表时也要明确告诉模型，避免它拿记忆补
      notice:
        matched.length === 0
          ? "没有符合条件的站内型号。不要编造，直接告诉用户站内未收录或条件过严。"
          : undefined,
      models: rows.map((model) => compactModel(model, currency)),
    },
    citedIds: rows.map((model) => model.id),
  };
}

function estimateCostTool(raw: unknown, models: Model[]): ToolOutcome {
  const parsed = TOOL_SCHEMAS.estimate_cost.safeParse(raw ?? {});
  if (!parsed.success) {
    return { result: { error: "参数不合法", detail: parsed.error.issues[0]?.message }, citedIds: [] };
  }
  const args = parsed.data;
  const currency = args.currency ?? "CNY";
  const assumptions = {
    ...DEFAULT_ASSUMPTIONS,
    dailyRequests: args.dailyRequests ?? DEFAULT_ASSUMPTIONS.dailyRequests,
    inputTokens: args.inputTokens ?? DEFAULT_ASSUMPTIONS.inputTokens,
    outputTokens: args.outputTokens ?? DEFAULT_ASSUMPTIONS.outputTokens,
    cacheHitRate: args.cacheHitRate ?? DEFAULT_ASSUMPTIONS.cacheHitRate,
    retryRate: args.retryRate ?? DEFAULT_ASSUMPTIONS.retryRate,
    outputInflate: args.outputInflate ?? DEFAULT_ASSUMPTIONS.outputInflate,
    days: args.days ?? DEFAULT_ASSUMPTIONS.days,
  };

  const rows: unknown[] = [];
  const missing: string[] = [];
  const citedIds: string[] = [];

  for (const id of args.modelIds) {
    const model = models.find((candidate) => candidate.id === id);
    const unit = model ? unitPriceFromModel(model, currency) : null;
    if (!model || !unit) {
      missing.push(id);
      continue;
    }
    citedIds.push(model.id);
    const result = estimateCost(unit, assumptions);
    rows.push({
      id: model.id,
      name: model.name,
      vendor: vendorLabel(model.vendor),
      currency,
      unitPrice: unit,
      assumptions,
      perCall: result.perCall,
      daily: result.daily,
      monthly: result.monthly,
      cacheApplied: result.cacheApplied,
      perCallText: formatMoney(result.perCall, currency),
      dailyText: formatMoney(result.daily, currency),
      monthlyText: formatMoney(result.monthly, currency),
    });
  }

  return {
    result: {
      currency,
      models: rows,
      missing,
      notice:
        missing.length > 0
          ? `以下型号在 ${currency} 下没有站内报价，未参与估算，不能当作 0 或换算：${missing.join(", ")}`
          : undefined,
    },
    citedIds,
  };
}

function compareModels(raw: unknown, models: Model[]): ToolOutcome {
  const parsed = TOOL_SCHEMAS.compare_models.safeParse(raw ?? {});
  if (!parsed.success) {
    return { result: { error: "参数不合法", detail: parsed.error.issues[0]?.message }, citedIds: [] };
  }
  const args = parsed.data;
  const currency = args.currency ?? "CNY";
  const found: Model[] = [];
  const missing: string[] = [];

  for (const id of args.modelIds) {
    const model = models.find((candidate) => candidate.id === id);
    if (model) found.push(model);
    else missing.push(id);
  }

  return {
    result: {
      currency,
      models: found.map((model) => compactModel(model, currency)),
      missing,
      notice:
        missing.length > 0
          ? `以下型号站内未收录：${missing.join(", ")}。不要为它们编造参数。`
          : undefined,
    },
    citedIds: found.map((model) => model.id),
  };
}

export function runTool(name: string, args: unknown, models: Model[]): ToolOutcome {
  if (name === "search_models") return searchModels(args, models);
  if (name === "estimate_cost") return estimateCostTool(args, models);
  if (name === "compare_models") return compareModels(args, models);
  return {
    result: { error: `未知工具：${name}。可用的工具是 search_models / estimate_cost / compare_models。` },
    citedIds: [],
  };
}

export function citationsFor(ids: string[], models: Model[]): ToolCitation[] {
  const seen = new Set<string>();
  const list: ToolCitation[] = [];
  for (const id of ids) {
    if (seen.has(id)) continue;
    const model = models.find((candidate) => candidate.id === id);
    if (!model) continue;
    seen.add(id);
    list.push({ id: model.id, name: model.name, vendor: vendorLabel(model.vendor) });
    if (list.length >= 6) break;
  }
  return list;
}

// 自定义端点只允许 https 公网域名，避免服务端被当成内网探测跳板
export function normalizeBaseUrl(raw: string | null | undefined): string | null {
  if (!raw || raw.trim() === "") return DEFAULT_BASE_URL;
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;
  if (url.username || url.password) return null;
  const host = url.hostname.toLowerCase();
  if (
    host === "localhost" ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    host === "0.0.0.0" ||
    host.includes(":")
  ) {
    return null;
  }
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return null;
  return `${url.origin}${url.pathname.replace(/\/+$/, "")}`;
}