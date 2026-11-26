import { readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fetchJson, fetchJsonWithFallback } from "./fetch";
import {
  AliasFileSchema,
  CnyPriceFileSchema,
  DatasetSchema,
  ManualScoresFileSchema,
  type Model,
} from "../../lib/types";
import { findBestMatch } from "../../lib/normalize";
import { SOURCES } from "../../lib/providers";

type MdModel = {
  id: string;
  name: string;
  release_date?: string;
  knowledge?: string;
  open_weights?: boolean;
  reasoning?: boolean;
  tool_call?: boolean;
  structured_output?: boolean;
  modalities?: { input?: string[]; output?: string[] };
  cost?: { input?: number; output?: number; cache_read?: number };
  limit?: { context?: number; output?: number };
};
type MdProvider = { id: string; name: string; doc?: string; models: Record<string, MdModel> };
type MdResponse = Record<string, MdProvider>;

type OrModel = {
  id: string;
  name: string;
  created: number;
  context_length: number;
  architecture?: { input_modalities?: string[] };
  supported_parameters?: string[];
  reasoning?: unknown;
  pricing?: { prompt?: string; completion?: string; input_cache_read?: string };
  benchmarks?: { artificial_analysis?: Record<string, number | null> };
};
type OrResponse = { data: OrModel[] };

type LiteLLMEntry = {
  input_cost_per_token?: number;
  output_cost_per_token?: number;
  litellm_provider?: string;
  source?: string;
};
type LiteLLMResponse = Record<string, LiteLLMEntry>;

const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, "data");
const today = new Date().toISOString();
const todayDate = today.slice(0, 10);
const perM = 1_000_000;

const LITELLM_PREFIXES: Record<string, string[]> = {
  alibaba: ["dashscope/", "alibaba/"],
  deepseek: ["deepseek/"],
  zhipu: ["zhipu/", "zai/"],
  moonshot: ["moonshot/"],
  bytedance: ["volcengine/"],
  minimax: ["minimax/"],
  stepfun: ["stepfun/"],
  tencent: ["tencent/"],
  baidu: ["baidu/"],
};

function readJson<T>(file: string): T {
  return JSON.parse(readFileSync(path.join(OUT_DIR, file), "utf8")) as T;
}

function round(n: number): number {
  return Math.round(n * 1e6) / 1e6;
}

async function main() {
  const aliasFile = AliasFileSchema.parse(readJson("aliases.json"));
  const cnyFile = CnyPriceFileSchema.parse(readJson("prices-cny.json"));
  const manualScores = ManualScoresFileSchema.parse(readJson("scores-manual.json"));

  const ids = aliasFile.models.map((m) => m.id);
  const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
  if (dupes.length) throw new Error(`aliases.json 存在重复 id：${dupes.join(", ")}`);

  const [mdRes, orRes, llRes] = await Promise.allSettled([
    fetchJson<MdResponse>(SOURCES.modelsdev.url, SOURCES.modelsdev.name),
    fetchJson<OrResponse>(SOURCES.openrouter.url, SOURCES.openrouter.name),
    fetchJsonWithFallback<LiteLLMResponse>(
      [SOURCES.litellm.mirrorUrl, SOURCES.litellm.url],
      SOURCES.litellm.name,
    ),
  ]);

  if (mdRes.status === "rejected") {
    throw new Error(`主数据源 models.dev 不可用，中止本次同步：${String(mdRes.reason)}`);
  }

  const warnings: string[] = [];
  const warn = (msg: string) => {
    if (warnings.length < 200) warnings.push(msg);
  };

  const md = mdRes.value.data;
  const or = orRes.status === "fulfilled" ? orRes.value.data.data : [];
  const ll = llRes.status === "fulfilled" ? llRes.value.data : {};

  if (orRes.status === "rejected") warn(`OpenRouter 不可用，评测分与美元旁证缺失：${String(orRes.reason)}`);
  if (llRes.status === "rejected") warn(`LiteLLM 不可用，价格交叉校验跳过：${String(llRes.reason)}`);

  const mdIndex = new Map<string, { provider: MdProvider; model: MdModel }>();
  for (const provider of Object.values(md)) {
    for (const model of Object.values(provider.models)) {
      mdIndex.set(`${provider.id}/${model.id}`, { provider, model });
    }
  }

  const orList = Object.values(or);
  const llEntries = Object.entries(ll).map(([key, value]) => ({ key, value }));

  const models: Model[] = [];
  let cnyVerified = 0;
  let cnyReported = 0;
  const foreignVendors = new Set(["openai", "anthropic", "google"]);

  for (const alias of aliasFile.models) {
    let base: { provider: MdProvider; model: MdModel } | undefined;
    for (const ref of alias.modelsdev) {
      const found = mdIndex.get(ref);
      if (found) {
        base = found;
        break;
      }
      warn(`${alias.id}: models.dev 中未找到 "${ref}"`);
    }

    let orModel: OrModel | undefined;
    if (alias.openrouter) {
      orModel = orList.find((m) => m.id === alias.openrouter);
      if (!orModel) warn(`${alias.id}: OpenRouter 中未找到 "${alias.openrouter}"`);
    }
    if (!orModel) {
      const fuzzy = findBestMatch(alias.name, orList, (m) => m.id);
      if (fuzzy && fuzzy.reason === "exact") {
        orModel = fuzzy.item;
        console.log(`  · ${alias.id} 按名称精确匹配到 OpenRouter "${fuzzy.item.id}"`);
      }
    }

    if (!base && !orModel) {
      warn(`${alias.id}: 两个源都未匹配到，跳过`);
      continue;
    }

    const inputModalities = base?.model.modalities?.input ?? orModel?.architecture?.input_modalities ?? [];
    const mdCost = base?.model.cost;
    const mdHasPrice = mdCost != null && (mdCost.input ?? 0) > 0 && (mdCost.output ?? 0) > 0;
    // OpenRouter 的 ":free" 预览渠道标价 0，不能当作美元参考价
    const orInUsd = Number(orModel?.pricing?.prompt ?? 0) * perM;
    const orOutUsd = Number(orModel?.pricing?.completion ?? 0) * perM;

    let priceUsd: Model["priceUsd"] = null;
    if (mdHasPrice) {
      priceUsd = {
        input: round(mdCost!.input!),
        output: round(mdCost!.output!),
        cacheRead: mdCost!.cache_read != null ? round(mdCost!.cache_read) : null,
        currency: "USD",
        unit: "per_1m_tokens",
        sourceUrl: base?.provider.doc || SOURCES.modelsdev.url,
        verifiedAt: todayDate,
        status: "auto",
      };
    } else if (orModel && orInUsd > 0 && orOutUsd > 0) {
      priceUsd = {
        input: round(orInUsd),
        output: round(orOutUsd),
        cacheRead: orModel.pricing?.input_cache_read
          ? round(Number(orModel.pricing.input_cache_read) * perM)
          : null,
        currency: "USD",
        unit: "per_1m_tokens",
        sourceUrl: `https://openrouter.ai/models/${orModel.id}`,
        verifiedAt: todayDate,
        status: "auto",
      };
    } else {
      warn(`${alias.id}: 无可用的美元价格`);
    }

    const cny = cnyFile.prices[alias.id];
    if (cny) {
      if (cny.confidence === "third-party") cnyReported++;
      else cnyVerified++;
    } else if (!foreignVendors.has(alias.vendor)) {
      warn(`${alias.id}: 缺少人民币官方价（待人工校验）`);
    }

    const scores: Model["scores"] = [];
    const aa = orModel?.benchmarks?.artificial_analysis;
    if (aa) {
      const map: [string, string][] = [
        ["intelligence_index", "aa_intelligence"],
        ["coding_index", "aa_coding"],
        ["agentic_index", "aa_agentic"],
      ];
      for (const [field, benchmark] of map) {
        const score = aa[field];
        if (typeof score === "number") {
          scores.push({
            benchmark,
            score,
            source: "Artificial Analysis（经 OpenRouter）",
            sourceUrl: `https://openrouter.ai/models/${orModel!.id}`,
            asOf: todayDate,
          });
        }
      }
    }

    const sources: Model["sources"] = [];
    for (const ref of alias.modelsdev) if (mdIndex.has(ref)) sources.push({ name: "models.dev", ref });
    if (orModel) sources.push({ name: "OpenRouter", ref: orModel.id });

    if (priceUsd && orModel?.pricing?.prompt) {
      const orInput = Number(orModel.pricing.prompt) * perM;
      const diff = Math.abs(orInput - priceUsd.input) / priceUsd.input;
      // OpenRouter 是第三方零售渠道，与官方 API 价存在加价属正常，只在差距过大时提示
      if (diff > 0.4) {
        warn(
          `${alias.id}: 渠道价差 ${(diff * 100).toFixed(0)}%（官方 ${priceUsd.input} vs OpenRouter ${round(orInput)} USD/M）`,
        );
      }
    }

    if (priceUsd) {
      const prefixes = LITELLM_PREFIXES[alias.vendor] ?? [];
      const candidates = llEntries.filter((e) => prefixes.some((p) => e.key.startsWith(p)));
      const match = findBestMatch(base?.model.id ?? orModel!.id, candidates, (e) => e.key);
      if (match?.reason === "exact" && match.item.value.input_cost_per_token) {
        const llInput = match.item.value.input_cost_per_token * perM;
        const diff = Math.abs(llInput - priceUsd.input) / priceUsd.input;
        if (diff > 0.3) {
          warn(
            `${alias.id}: LiteLLM 输入价 ${round(llInput)} 与主数据源 ${priceUsd.input} 差异 ${(diff * 100).toFixed(0)}%`,
          );
        }
        sources.push({ name: "LiteLLM", ref: match.item.key });
      }
    }

    models.push({
      id: alias.id,
      name: alias.name,
      vendor: alias.vendor,
      contextWindow: base?.model.limit?.context ?? orModel?.context_length ?? 0,
      maxOutput: base?.model.limit?.output ?? 0,
      releaseDate:
        base?.model.release_date ??
        (orModel?.created ? new Date(orModel.created * 1000).toISOString().slice(0, 10) : null),
      knowledgeCutoff: base?.model.knowledge ?? null,
      openWeights: alias.openWeights ?? base?.model.open_weights ?? null,
      capabilities: {
        reasoning: Boolean(base?.model.reasoning ?? orModel?.reasoning),
        toolCall: Boolean(
          base?.model.tool_call ?? orModel?.supported_parameters?.includes("tools"),
        ),
        structuredOutput: Boolean(
          base?.model.structured_output ??
            orModel?.supported_parameters?.includes("structured_outputs"),
        ),
        vision: inputModalities.includes("image"),
        cache: priceUsd?.cacheRead != null,
      },
      priceUsd,
      priceCny: cny
        ? {
            input: cny.input,
            output: cny.output,
            cacheRead: cny.cacheRead ?? null,
            currency: "CNY",
            unit: "per_1m_tokens",
            sourceUrl: cny.sourceUrl,
            verifiedAt: cny.verifiedAt,
            status: cny.confidence === "third-party" ? "reported" : "verified",
            note: cny.note,
          }
        : null,
      scores,
      sources,
    });

    if (!base) warn(`${alias.id}: 缺少 models.dev 数据，上下文/能力可能不完整`);
    if (!models[models.length - 1].contextWindow) warn(`${alias.id}: 上下文长度缺失`);
  }

  // 合并人工录入的 L2 评测分：块级来源/日期，逐条校验模型 id 与数值范围
  const benchmarkStats: { id: string; label: string; source: string; asOf: string; count: number }[] =
    [];
  for (const [benchmarkId, block] of Object.entries(manualScores.benchmarks)) {
    let applied = 0;
    for (const [modelId, raw] of Object.entries(block.scores)) {
      const model = models.find((m) => m.id === modelId);
      if (!model) {
        warn(`${benchmarkId}: 未知模型 id "${modelId}"，已忽略`);
        continue;
      }
      const valid =
        Number.isFinite(raw) && (block.unit === "percent" ? raw >= 0 && raw <= 100 : raw > 0);
      if (!valid) {
        warn(`${benchmarkId}: ${modelId} 的分值 ${raw} 超出 ${block.unit} 的合理范围，已忽略`);
        continue;
      }
      if (model.scores.some((s) => s.benchmark === benchmarkId)) continue;
      model.scores.push({
        benchmark: benchmarkId,
        score: raw,
        source: block.source,
        sourceUrl: block.sourceUrl ?? "",
        asOf: block.asOf ?? "",
      });
      applied++;
    }
    benchmarkStats.push({
      id: benchmarkId,
      label: block.label,
      source: block.source,
      asOf: block.asOf ?? "",
      count: applied,
    });
    if (applied === 0) warn(`${benchmarkId}: 没有任何分值落到模型上，检查模型 id 是否写错`);
  }

  const dataset = {
    version: 1 as const,
    updatedAt: today,
    models: models.sort((a, b) => a.id.localeCompare(b.id)),
  };

  const parsed = DatasetSchema.safeParse(dataset);
  if (!parsed.success) {
    console.error("数据校验失败：");
    console.error(parsed.error.issues.slice(0, 20));
    process.exit(1);
  }

  const meta = {
    updatedAt: todayDate,
    modelCount: models.length,
    cnyVerified,
    cnyReported,
    benchmarks: benchmarkStats,
    sources: [
      {
        name: SOURCES.modelsdev.name,
        ok: mdRes.status === "fulfilled",
        fetchedAt: mdRes.value.fetchedAt.slice(0, 10),
        count: mdIndex.size,
      },
      {
        name: SOURCES.openrouter.name,
        ok: orRes.status === "fulfilled",
        fetchedAt: orRes.status === "fulfilled" ? orRes.value.fetchedAt.slice(0, 10) : "—",
        count: or.length,
      },
      {
        name: SOURCES.litellm.name,
        ok: llRes.status === "fulfilled",
        fetchedAt: llRes.status === "fulfilled" ? llRes.value.fetchedAt.slice(0, 10) : "—",
        count: llEntries.length,
      },
    ],
    warnings,
  };

  const csvHeader =
    "id,name,vendor,usd_input,usd_output,usd_cache,usd_source,cny_input,cny_output,cny_status,cny_source";
  const csvRows = models.map((m) =>
    [
      m.id,
      `"${m.name}"`,
      m.vendor,
      m.priceUsd?.input ?? "",
      m.priceUsd?.output ?? "",
      m.priceUsd?.cacheRead ?? "",
      m.priceUsd?.sourceUrl ?? "",
      m.priceCny?.input ?? "",
      m.priceCny?.output ?? "",
      m.priceCny ? "verified" : "pending",
      m.priceCny?.sourceUrl ?? "",
    ].join(","),
  );

  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(path.join(OUT_DIR, "models.json"), JSON.stringify(dataset, null, 2) + "\n");
  await writeFile(path.join(OUT_DIR, "meta.json"), JSON.stringify(meta, null, 2) + "\n");
  await writeFile(
    path.join(OUT_DIR, "price-review.csv"),
    [csvHeader, ...csvRows].join("\n") + "\n",
  );

  console.log(`\n✓ ${models.length} 个模型写入 data/models.json`);
  console.log(`✓ 人民币：官方核验 ${cnyVerified}，第三方转引 ${cnyReported}，其余待补（清单见 data/price-review.csv）`);
  if (benchmarkStats.length > 0) {
    console.log(
      `✓ 人工评测分：${benchmarkStats.map((b) => `${b.label} ${b.count} 个`).join("，")}`,
    );
  }
  console.log(`  警告 ${warnings.length} 条（见 data/meta.json）`);
  for (const w of warnings.slice(0, 10)) console.log(`  - ${w}`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});