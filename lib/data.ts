import { readFileSync } from "node:fs";
import path from "node:path";
import { z } from "zod";
import { DatasetSchema, type Dataset } from "./types";

const MetaSchema = z.object({
  updatedAt: z.string(),
  modelCount: z.number(),
  cnyVerified: z.number(),
  cnyReported: z.number(),
  sources: z.array(
    z.object({
      name: z.string(),
      ok: z.boolean(),
      fetchedAt: z.string(),
      count: z.number(),
    }),
  ),
  warnings: z.array(z.string()),
  benchmarks: z
    .array(
      z.object({
        id: z.string(),
        label: z.string(),
        source: z.string(),
        asOf: z.string(),
        count: z.number(),
      }),
    )
    .default([]),
});

export type Meta = z.infer<typeof MetaSchema>;

const DATA_DIR = path.join(process.cwd(), "data");

function readData(file: string): unknown {
  return JSON.parse(readFileSync(path.join(DATA_DIR, file), "utf8"));
}

export function loadDataset(): Dataset {
  return DatasetSchema.parse(readData("models.json"));
}

export function loadMeta(): Meta {
  return MetaSchema.parse(readData("meta.json"));
}