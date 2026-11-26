import type { Model } from "./types";
import { matchesSearch } from "./search";

export type Currency = "CNY" | "USD";
export type BoardId = "overall" | "code" | "writing" | "rag" | "value" | "cheap";

export const VENDOR_LABELS: Record<string, string> = {
  alibaba: "阿里",
  deepseek: "DeepSeek",
  zhipu: "智谱",
  moonshot: "月之暗面",
  bytedance: "字节",
  minimax: "MiniMax",
  stepfun: "阶跃",
  tencent: "腾讯",
  baidu: "百度",
  openai: "OpenAI",
  anthropic: "Anthropic",
  google: "Google",
};

export function vendorLabel(vendor: string): string {
  return VENDOR_LABELS[vendor] ?? vendor;
}

// 国际模型只作成本参照，默认不进国内榜的默认视图
export const FOREIGN_VENDORS = new Set(["openai", "anthropic", "google"]);

export function isForeign(model: Model): boolean {
  return FOREIGN_VENDORS.has(model.vendor);
}

export function benchmarkScore(model: Model, benchmark: string): number | null {
  const hit = model.scores.find((s) => s.benchmark === benchmark);
  return hit ? hit.score : null;
}

export function priceIn(model: Model, currency: Currency) {
  return currency === "CNY" ? model.priceCny : model.priceUsd;
}

type FallbackRank = "comprehensive" | "context" | "input" | "value";

type MetricCandidate = {
  id: string;
  // 同一子榜的不同指标必须用自己的列名，不能把智能体分写成代码分
  label: string;
  banner?: string;
};

type MetricSpec = {
  // 依次尝试；哪块有人工录入数据就用哪块
  benchmarks: MetricCandidate[];
  dir: "asc" | "desc";
  format: "decimal" | "integer";
  // 默认只保留有分的型号；综合榜例外——它是入口页，要让人看到全部型号
  keepUnscored?: boolean;
};

export type BoardSpec = {
  id: BoardId;
  label: string;
  question: string;
  metric: MetricSpec | null;
  fallback: {
    label: string;
    dir: "asc" | "desc";
    rank: FallbackRank;
    banner: string;
  };
};

export type Board = {
  id: BoardId;
  label: string;
  question: string;
  scoreLabel: string;
  banner?: string;
  dir: "asc" | "desc";
  format: "decimal" | "integer";
  score: (model: Model, currency: Currency) => number | null;
  rank: (model: Model, currency: Currency) => number | null;
  // true = 没有该子榜指标的型号不进榜（专属指标或性价比榜）
  onlyRanked?: boolean;
  // 实际生效的专属指标 id；走兜底时为 null
  activeBenchmark: string | null;
  // 分数列的数据来源；兜底排序时指向所用的综合指标，纯价格/上下文排序为 null
  basisBenchmark: string | null;
};

const SPECS: BoardSpec[] = [
  {
    id: "overall",
    label: "综合能力",
    question: "不知道从哪选时的起点",
    metric: {
      // 司南 V3.0 对国内型号覆盖最全，优先；AA 覆盖 3 个国际参照，作次选
      benchmarks: [
        { id: "opencompass_overall", label: "综合分" },
        { id: "aa_intelligence", label: "综合分 (AA)" },
        { id: "superclue_overall", label: "SuperCLUE 总分" },
      ],
      dir: "desc",
      format: "decimal",
      keepUnscored: true,
    },
    fallback: {
      label: "综合分",
      dir: "desc",
      rank: "comprehensive",
      banner: "暂无综合类评测数据：所有型号都没有可比的综合分。",
    },
  },
  {
    id: "code",
    label: "代码与工具调用",
    question: "做 Coding Agent / 工作流编排",
    metric: {
      benchmarks: [
        {
          id: "swe_bench_verified",
          label: "代码分 (%)",
          banner:
            "SWE-bench Verified 是社区自报提交榜，Agent 与 harness 各不相同，分数只代表该条提交的配置，不等于裸模型编码能力。",
        },
        { id: "opencompass_code", label: "代码分" },
        { id: "livecodebench", label: "代码分 (LiveCodeBench)" },
        {
          // 司南 V3.0 没有独立代码子榜，智能体只作工具调用参考
          id: "opencompass_agentic",
          label: "智能体分",
          banner:
            "司南 V3.0 没有独立代码子榜，本榜当前用「智能体」维度（工具调用与任务执行）代替，它衡量的是把任务做完的能力，不是纯代码编写。纯编码能力请看模型技术报告里的自报分数。",
        },
      ],
      dir: "desc",
      format: "decimal",
    },
    fallback: {
      label: "综合分※",
      dir: "desc",
      rank: "comprehensive",
      banner:
        "代码与工具调用子分（SWE-bench / τ²-Bench）尚未接入，本榜先按综合分排序。可用下方「工具调用」筛选锁定真正能挂工具的型号。",
    },
  },
  {
    id: "writing",
    label: "中文写作与长文",
    question: "内容生成、公文、摘要",
    metric: {
      // SuperCLUE 2026-11 总榜已无写作单项，不能拿总分顶替，故不列 superclue_zh
      benchmarks: [
        { id: "superclue_zh_writing", label: "中文写作分" },
        { id: "opencompass_writing", label: "中文写作分" },
      ],
      dir: "desc",
      format: "decimal",
    },
    fallback: {
      label: "综合分※",
      dir: "desc",
      rank: "comprehensive",
      banner:
        "SuperCLUE 2026-11 总榜没有独立的写作/文本创作维度，中文写作子分仍未接入，本榜先按综合分排序。长文场景请同时看「上下文」列与输出价——摘要类任务输出 token 往往比输入多。",
    },
  },
  {
    id: "rag",
    label: "知识问答 / RAG",
    question: "企业知识库、客服",
    metric: {
      benchmarks: [
        { id: "opencompass_knowledge", label: "知识问答分" },
        { id: "simpleqa", label: "SimpleQA 正确率 (%)" },
        { id: "knowledge_qa", label: "知识问答分" },
      ],
      dir: "desc",
      format: "decimal",
    },
    fallback: {
      label: "综合分※",
      dir: "desc",
      rank: "context",
      banner:
        "事实性与知识问答评测尚未接入，本榜暂按「声明上下文长度」排序。声明上下文 ≠ 有效上下文：检索塞满上下文后，中段内容召回会明显下降。",
    },
  },
  {
    id: "value",
    label: "性价比",
    question: "预算受限时的第一筛选",
    metric: null,
    fallback: {
      label: "分/元",
      dir: "desc",
      rank: "value",
      banner:
        "性价比 = 综合分 ÷ 输入单价（分 / 每百万 token，按当前币种计算）。免费型号和没有综合分的型号不参与排名——除以 0 得出的「无限性价比」是误导。",
    },
  },
  {
    id: "cheap",
    label: "高速低价",
    question: "高并发轻任务、分类打标",
    metric: {
      benchmarks: [
        {
          id: "ttft_ms",
          label: "首 token (ms)",
          banner:
            "测速来自 Artificial Analysis 模型页的 Time to First Tokens，只覆盖部分型号。思考型模型的首个答案 token 更晚，本列不反映这段等待，交互类场景要单独看。",
        },
        { id: "output_tokens_per_s", label: "输出速度 (tok/s)" },
      ],
      dir: "asc",
      format: "integer",
    },
    fallback: {
      label: "综合分※",
      dir: "asc",
      rank: "input",
      banner:
        "延迟与吞吐（首 token 时间 / tokens per second）尚未接入，本榜暂按输入单价从低到高排序，仅供粗筛。轻任务也别直接上最便宜的型号，先测指令遵循。",
    },
  },
];

export function getBoardSpec(id: BoardId): BoardSpec {
  return SPECS.find((spec) => spec.id === id) ?? SPECS[0];
}

export function boardSpecs(): BoardSpec[] {
  return SPECS;
}

// 综合榜当前实际使用的指标。性价比和兜底排序都必须跟它一致，
// 否则同一页里会出现两个模型按不同榜单的分数比高低。
export function overallBenchmarkId(models: Model[]): string | null {
  const candidates = getBoardSpec("overall").metric?.benchmarks ?? [];
  return (
    candidates.find((candidate) =>
      models.some((model) => benchmarkScore(model, candidate.id) != null),
    )?.id ?? null
  );
}

const valueIndex = (
  model: Model,
  currency: Currency,
  overallId: string | null,
): number | null => {
  const score = overallId ? benchmarkScore(model, overallId) : null;
  const price = priceIn(model, currency);
  if (score == null || !price || price.input <= 0) return null;
  return score / price.input;
};

function fallbackRanker(
  rank: FallbackRank,
  overallId: string | null,
): (model: Model, currency: Currency) => number | null {
  switch (rank) {
    case "comprehensive":
      return (model) => (overallId ? benchmarkScore(model, overallId) : null);
    case "context":
      return (model) => model.contextWindow || null;
    case "input":
      return (model, currency) => priceIn(model, currency)?.input ?? null;
    case "value":
      return (model, currency) => valueIndex(model, currency, overallId);
  }
}

// 有专属指标数据 → 用专属指标，且只保留有分的型号；否则退回兜底排序并挂黄条
export function resolveBoard(spec: BoardSpec, models: Model[]): Board {
  const overallId = overallBenchmarkId(models);

  if (spec.metric) {
    const active = spec.metric.benchmarks.find((candidate) =>
      models.some((model) => benchmarkScore(model, candidate.id) != null),
    );
    if (active) {
      return {
        id: spec.id,
        label: spec.label,
        question: spec.question,
        scoreLabel: active.label,
        banner: active.banner,
        dir: spec.metric.dir,
        format: spec.metric.format,
        score: (model) => benchmarkScore(model, active.id),
        rank: (model) => benchmarkScore(model, active.id),
        onlyRanked: !spec.metric.keepUnscored,
        activeBenchmark: active.id,
        basisBenchmark: active.id,
      };
    }
  }

  const usesOverall = spec.fallback.rank === "value" || spec.fallback.rank === "comprehensive";

  return {
    id: spec.id,
    label: spec.label,
    question: spec.question,
    scoreLabel: spec.fallback.label,
    banner: spec.fallback.banner,
    dir: spec.fallback.dir,
    format: "decimal",
    score:
      spec.fallback.rank === "value"
        ? (model, currency) => valueIndex(model, currency, overallId)
        : (model) => (overallId ? benchmarkScore(model, overallId) : null),
    rank: fallbackRanker(spec.fallback.rank, overallId),
    onlyRanked: spec.fallback.rank === "value",
    activeBenchmark: null,
    basisBenchmark: usesOverall ? overallId : null,
  };
}

export type SortKey = "rank" | "input" | "output" | "cache" | "context" | "release";
export type SortState = { key: SortKey; dir: "asc" | "desc" };

export function sortValue(
  model: Model,
  key: SortKey,
  board: Board,
  currency: Currency,
): number | null {
  switch (key) {
    case "rank":
      return board.rank(model, currency);
    case "input":
      return priceIn(model, currency)?.input ?? null;
    case "output":
      return priceIn(model, currency)?.output ?? null;
    case "cache":
      return priceIn(model, currency)?.cacheRead ?? null;
    case "context":
      return model.contextWindow || null;
    case "release":
      return model.releaseDate ? Date.parse(model.releaseDate) : null;
  }
}

export function sortModels(
  models: Model[],
  board: Board,
  currency: Currency,
  sort: SortState | null,
): Model[] {
  const key = sort?.key ?? "rank";
  const factor = (sort?.dir ?? board.dir) === "asc" ? 1 : -1;
  const pool = board.onlyRanked
    ? models.filter((model) => board.rank(model, currency) != null)
    : models;
  return [...pool].sort((a, b) => {
    const av = sortValue(a, key, board, currency);
    const bv = sortValue(b, key, board, currency);
    if (av == null && bv == null) return a.name.localeCompare(b.name);
    if (av == null) return 1;
    if (bv == null) return -1;
    if (av === bv) return a.name.localeCompare(b.name);
    return factor * (av - bv);
  });
}

export type Weights = "all" | "open" | "closed";
export type CapKey = "toolCall" | "reasoning" | "vision" | "cache";

export type Filters = {
  query: string;
  vendors: string[];
  weights: Weights;
  minContext: number;
  maxInput: number | null;
  caps: CapKey[];
  currency: Currency;
  includeForeign: boolean;
};

export const DEFAULT_FILTERS: Filters = {
  query: "",
  vendors: [],
  weights: "all",
  minContext: 0,
  maxInput: null,
  caps: [],
  currency: "CNY",
  includeForeign: false,
};

export function filterModels(models: Model[], filters: Filters): Model[] {
  const fields = (model: Model) => [
    model.name,
    model.id,
    vendorLabel(model.vendor),
    model.vendor,
  ];
  // 精确命中优先；一条都没有时才启用单字容错，避免搜 3.8 带出 3.5/3.6/3.7
  const fuzzy =
    filters.query !== "" &&
    !models.some((model) => matchesSearch(filters.query, fields(model), false));

  return models.filter((model) => {
    if (!filters.includeForeign && isForeign(model)) return false;
    if (filters.query && !matchesSearch(filters.query, fields(model), fuzzy)) {
      return false;
    }
    if (filters.vendors.length > 0 && !filters.vendors.includes(model.vendor)) return false;
    if (filters.weights === "open" && model.openWeights !== true) return false;
    if (filters.weights === "closed" && model.openWeights !== false) return false;
    if (model.contextWindow < filters.minContext) return false;
    if (filters.maxInput != null) {
      const price = priceIn(model, filters.currency);
      if (!price || price.input > filters.maxInput) return false;
    }
    for (const cap of filters.caps) {
      if (!model.capabilities[cap]) return false;
    }
    return true;
  });
}

export function formatContext(tokens: number): string {
  if (!tokens) return "—";
  if (tokens >= 1_000_000) return `${(tokens / 1_048_576).toFixed(1).replace(/\.0$/, "")}M`;
  return `${Math.round(tokens / 1024)}K`;
}

export function formatPrice(value: number | null | undefined, currency: Currency): string {
  if (value == null) return "—";
  if (value === 0) return "免费";
  const symbol = currency === "CNY" ? "¥" : "$";
  const digits = value >= 100 ? 0 : 2;
  return `${symbol}${Number(value.toFixed(digits))}`;
}

export function formatScore(value: number | null, format: "decimal" | "integer"): string {
  if (value == null) return "—";
  return format === "integer" ? String(Math.round(value)) : value.toFixed(1);
}

export function formatMonth(date: string | null): string {
  return date ? date.slice(0, 7) : "—";
}

export function priceStatusLabel(status: "auto" | "verified" | "reported"): string {
  if (status === "verified") return "官方核验";
  if (status === "reported") return "第三方转引";
  return "自动抓取";
}

export type BenchmarkMeta = {
  id: string;
  label: string;
  source?: string;
  asOf?: string;
  count?: number;
};

export function benchmarkMeta(
  benchmarks: BenchmarkMeta[] | undefined,
  id: string | null,
): BenchmarkMeta | null {
  if (!benchmarks || !id) return null;
  return benchmarks.find((b) => b.id === id) ?? null;
}