import { z } from "zod";

export const PriceSchema = z.object({
  input: z.number().nonnegative(),
  output: z.number().nonnegative(),
  cacheRead: z.number().nonnegative().nullable(),
  currency: z.enum(["USD", "CNY"]),
  unit: z.literal("per_1m_tokens"),
  sourceUrl: z.string(),
  verifiedAt: z.string().nullable(),
  status: z.enum(["auto", "verified", "reported"]),
  note: z.string().optional(),
});

const CapabilitiesSchema = z.object({
  reasoning: z.boolean(),
  toolCall: z.boolean(),
  structuredOutput: z.boolean(),
  vision: z.boolean(),
  cache: z.boolean(),
});

export const ScoreSchema = z.object({
  benchmark: z.string(),
  score: z.number(),
  source: z.string(),
  sourceUrl: z.string(),
  asOf: z.string(),
});

export const ModelSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  vendor: z.string().min(1),
  contextWindow: z.number().int().nonnegative(),
  maxOutput: z.number().int().nonnegative(),
  releaseDate: z.string().nullable(),
  knowledgeCutoff: z.string().nullable(),
  openWeights: z.boolean().nullable(),
  capabilities: CapabilitiesSchema,
  priceUsd: PriceSchema.nullable(),
  priceCny: PriceSchema.nullable(),
  scores: z.array(ScoreSchema),
  sources: z.array(z.object({ name: z.string(), ref: z.string() })),
});

export const DatasetSchema = z.object({
  version: z.literal(1),
  updatedAt: z.string(),
  models: z.array(ModelSchema).min(1),
});

export const AliasFileSchema = z.object({
  version: z.literal(1),
  models: z.array(
    z.object({
      id: z.string().min(1),
      name: z.string().min(1),
      vendor: z.string().min(1),
      openWeights: z.boolean().optional(),
      modelsdev: z.array(z.string()).default([]),
      openrouter: z.string().optional(),
    }),
  ),
});

// 人工录入的 L2 评测分：一个 benchmark 一块，来源与日期写在块级，避免逐行重复
export const ManualScoresFileSchema = z.object({
  version: z.literal(1),
  benchmarks: z.record(
    z.string(),
    z.object({
      label: z.string().min(1),
      unit: z.enum(["percent", "score", "ms", "tokens_per_s"]),
      higherIsBetter: z.boolean(),
      source: z.string().min(1),
      sourceUrl: z.string().optional(),
      // 榜单没有统一截止日期时写 null，不用抓取日期冒充
      asOf: z.string().min(1).nullable(),
      scores: z.record(z.string(), z.number()),
    }),
  ),
});

export const CnyPriceFileSchema = z.object({
  version: z.literal(1),
  prices: z.record(
    z.string(),
    z.object({
      input: z.number().nonnegative(),
      output: z.number().nonnegative(),
      cacheRead: z.number().nonnegative().optional(),
      sourceUrl: z.string(),
      verifiedAt: z.string(),
      note: z.string().optional(),
      // official = 直接核对厂商定价页；third-party = 媒体报道/聚合站，未核对官网
      confidence: z.enum(["official", "third-party"]).optional(),
    }),
  ),
});

export type Model = z.infer<typeof ModelSchema>;
export type Alias = z.infer<typeof AliasFileSchema>["models"][number];
export type Dataset = z.infer<typeof DatasetSchema>;