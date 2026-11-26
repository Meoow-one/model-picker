"use client";

import { useEffect, useMemo, useState } from "react";
import type { Model } from "@/lib/types";
import {
  formatPrice,
  priceIn,
  priceStatusLabel,
  vendorLabel,
  type Currency,
} from "@/lib/leaderboard";
import {
  DEFAULT_ASSUMPTIONS,
  estimateCost,
  formatMoney,
  unitPriceFromModel,
  type CostAssumptions,
} from "@/lib/cost";

type Props = {
  models: Model[];
  updatedAt: string;
};

const DEFAULT_MODELS = ["qwen3.8-flash", "deepseek-v4.1-flash", "glm-5.3", "qwen4-max"];
const MAX_MODELS = 4;

// 预设只改 token 结构与命中率，业务量由用户自己填
const PRESETS: { label: string; hint: string; patch: Partial<CostAssumptions> }[] = [
  {
    label: "客服机器人",
    hint: "多轮对话，system prompt 可缓存",
    patch: { inputTokens: 800, outputTokens: 300, cacheHitRate: 0.3, retryRate: 0.03, outputInflate: 1 },
  },
  {
    label: "文档摘要",
    hint: "长输入、短输出",
    patch: { inputTokens: 6000, outputTokens: 800, cacheHitRate: 0, retryRate: 0.03, outputInflate: 1 },
  },
  {
    label: "RAG 知识库",
    hint: "检索片段高度重复，缓存命中高",
    patch: { inputTokens: 4000, outputTokens: 500, cacheHitRate: 0.5, retryRate: 0.03, outputInflate: 1 },
  },
  {
    label: "Coding Agent",
    hint: "长上下文 + 推理型输出",
    patch: { inputTokens: 8000, outputTokens: 1500, cacheHitRate: 0.6, retryRate: 0.05, outputInflate: 1.5 },
  },
];

export default function CostCalculator({ models, updatedAt }: Props) {
  const [currency, setCurrency] = useState<Currency>("CNY");
  const [assumptions, setAssumptions] = useState<CostAssumptions>(DEFAULT_ASSUMPTIONS);
  const [selected, setSelected] = useState<string[]>(() =>
    DEFAULT_MODELS.filter((id) => models.some((m) => m.id === id)),
  );

  // 从榜单「带入成本试算」跳过来时预选型号
  useEffect(() => {
    const raw = new URLSearchParams(window.location.search).get("models");
    if (!raw) return;
    const ids = raw
      .split(",")
      .map((id) => id.trim())
      .filter((id) => models.some((m) => m.id === id));
    if (ids.length > 0) setSelected(ids.slice(0, MAX_MODELS));
  }, [models]);

  const vendorGroups = useMemo(() => {
    const map = new Map<string, Model[]>();
    for (const model of models) {
      const list = map.get(model.vendor) ?? [];
      list.push(model);
      map.set(model.vendor, list);
    }
    return [...map.entries()]
      .map(([vendor, list]) => ({
        vendor,
        list: [...list].sort((a, b) => a.name.localeCompare(b.name)),
      }))
      .sort((a, b) => vendorLabel(a.vendor).localeCompare(vendorLabel(b.vendor), "zh-CN"));
  }, [models]);

  const selectedModels = useMemo(
    () =>
      selected
        .map((id) => models.find((m) => m.id === id))
        .filter((m): m is Model => m != null),
    [selected, models],
  );

  const rows = useMemo(
    () =>
      selectedModels.map((model) => {
        const price = priceIn(model, currency);
        const unit = unitPriceFromModel(model, currency);
        return { model, price, result: unit ? estimateCost(unit, assumptions) : null };
      }),
    [selectedModels, currency, assumptions],
  );

  const priced = useMemo(
    () =>
      rows
        .filter((row) => row.result != null)
        .sort((a, b) => (a.result?.monthly ?? 0) - (b.result?.monthly ?? 0)),
    [rows],
  );
  const unpriced = rows.filter((row) => row.result == null);

  const maxMonthly = priced.reduce((max, row) => Math.max(max, row.result?.monthly ?? 0), 0);
  const cheapest = priced[0];
  const cheapestMonthly = cheapest?.result?.monthly ?? 0;
  const priciest = priced[priced.length - 1];

  function update(patch: Partial<CostAssumptions>) {
    setAssumptions((prev) => ({ ...prev, ...patch }));
  }

  function addModel(id: string) {
    if (!id) return;
    setSelected((prev) =>
      prev.includes(id) || prev.length >= MAX_MODELS ? prev : [...prev, id],
    );
  }

  function removeModel(id: string) {
    setSelected((prev) => prev.filter((x) => x !== id));
  }

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">成本试算</h1>
          <p className="mt-1.5 text-[15px] text-ink-4">
            按业务量和 token 结构估算月账单 · 价格更新于 {updatedAt} · 月成本按 30 天
          </p>
        </div>
        <div className="flex items-center gap-0.5 rounded-full border border-line bg-surface-2 p-0.5 text-sm">
          {(
            [
              ["CNY", "人民币"],
              ["USD", "美元"],
            ] as [Currency, string][]
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setCurrency(value)}
              aria-pressed={currency === value}
              className={`rounded-full px-3.5 py-1.5 text-[13px] transition ${
                currency === value
                  ? "bg-surface font-semibold text-ink shadow-card"
                  : "text-ink-3 hover:text-ink"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
        <section className="card h-fit p-4">
          <h2 className="text-[15px] font-semibold text-ink">业务假设</h2>

          <div className="mt-3 flex flex-wrap gap-1.5">
            {PRESETS.map((preset) => (
              <button
                key={preset.label}
                type="button"
                title={preset.hint}
                onClick={() => setAssumptions((prev) => ({ ...prev, ...preset.patch }))}
                className="rounded-full border border-line px-3 py-1.5 text-[13px] text-ink-3 transition hover:border-ink-4 hover:text-ink"
              >
                {preset.label}
              </button>
            ))}
          </div>
          <p className="mt-1.5 text-xs leading-relaxed text-ink-4">
            预设只填 token 结构与命中率，请求量请按自己的业务改。
          </p>

          <div className="mt-4 space-y-3">
            <NumberField
              label="日请求量"
              value={assumptions.dailyRequests}
              min={0}
              step={100}
              onChange={(v) => update({ dailyRequests: v })}
            />
            <div className="grid grid-cols-2 gap-3">
              <NumberField
                label="平均输入 token"
                value={assumptions.inputTokens}
                min={0}
                step={100}
                onChange={(v) => update({ inputTokens: v })}
              />
              <NumberField
                label="平均输出 token"
                value={assumptions.outputTokens}
                min={0}
                step={50}
                onChange={(v) => update({ outputTokens: v })}
              />
            </div>
          </div>

          <div className="mt-4 space-y-4">
            <SliderField
              label="缓存命中率"
              display={`${Math.round(assumptions.cacheHitRate * 100)}%`}
              value={Math.round(assumptions.cacheHitRate * 100)}
              min={0}
              max={100}
              step={5}
              onChange={(v) => update({ cacheHitRate: v / 100 })}
              hint="只作用于输入 token，且型号要有缓存价"
            />
            <SliderField
              label="失败重试率"
              display={`${Math.round(assumptions.retryRate * 100)}%`}
              value={Math.round(assumptions.retryRate * 100)}
              min={0}
              max={10}
              step={1}
              onChange={(v) => update({ retryRate: v / 100 })}
              hint="按总成本等比放大"
            />
            <SliderField
              label="推理输出膨胀"
              display={`${assumptions.outputInflate.toFixed(1)}×`}
              value={assumptions.outputInflate}
              min={1}
              max={2}
              step={0.1}
              onChange={(v) => update({ outputInflate: v })}
              hint="推理模型常输出更多 token"
            />
          </div>

          <button
            type="button"
            onClick={() => setAssumptions(DEFAULT_ASSUMPTIONS)}
            className="mt-4 text-[13px] text-ink-4 underline-offset-4 hover:text-ink hover:underline"
          >
            恢复默认假设
          </button>
        </section>

        <div className="space-y-4">
          <section className="card p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-[15px] font-semibold text-ink">对比型号</h2>
              <span className="mono text-[13px] text-ink-4">{selected.length}/{MAX_MODELS}</span>
            </div>

            <div className="mt-3 flex flex-wrap gap-1.5">
              {selectedModels.map((model) => (
                <span
                  key={model.id}
                  className="inline-flex items-center gap-1 rounded-full bg-accent-soft px-3 py-1 text-[13px] text-accent-ink"
                >
                  {model.name}
                  <button
                    type="button"
                    onClick={() => removeModel(model.id)}
                    aria-label={`移除 ${model.name}`}
                    className="text-accent-ink/60 transition hover:text-accent-ink"
                  >
                    ×
                  </button>
                </span>
              ))}
              {selectedModels.length === 0 && (
                <span className="text-[15px] text-ink-4">还没有选型号。</span>
              )}
            </div>

            <select
              value=""
              onChange={(e) => addModel(e.target.value)}
              disabled={selected.length >= MAX_MODELS}
              aria-label="添加对比型号"
              className="mt-3 h-10 w-full rounded-lg border border-line bg-sunk px-2.5 text-[15px] text-ink outline-none transition focus:border-accent disabled:text-ink-4"
            >
              <option value="">
                {selected.length >= MAX_MODELS ? "已达 4 个上限" : "添加型号…"}
              </option>
              {vendorGroups.map((group) => (
                <optgroup key={group.vendor} label={vendorLabel(group.vendor)}>
                  {group.list.map((model) => {
                    const picked = selected.includes(model.id);
                    const hasPrice = priceIn(model, currency) != null;
                    return (
                      <option key={model.id} value={model.id} disabled={picked || !hasPrice}>
                        {model.name}
                        {picked
                          ? "（已选）"
                          : hasPrice
                            ? ""
                            : `（无${currency === "CNY" ? "人民币" : "美元"}报价）`}
                      </option>
                    );
                  })}
                </optgroup>
              ))}
            </select>
            <p className="mt-2 text-xs text-ink-4">
              在榜单勾选后点「带入成本试算」，这里会预选好型号。
            </p>
          </section>

          <section className="card p-4">
            <h2 className="text-[15px] font-semibold text-ink">
              月成本排序（{currency === "CNY" ? "人民币" : "美元"}）
            </h2>

            {priced.length === 0 ? (
              <p className="mt-4 rounded-lg border border-dashed border-line p-4 text-[15px] text-ink-3">
                所选型号在当前币种下都没有公开报价，无法估算——切到另一种币种，或先去榜单挑有价的型号。
              </p>
            ) : (
              <>
                <ul className="mt-3 space-y-2">
                  {priced.map((row, index) => {
                    const { model, price, result } = row;
                    if (!result) return null;
                    const monthly = result.monthly;
                    const width =
                      maxMonthly > 0 ? Math.max(monthly > 0 ? 2 : 0, (monthly / maxMonthly) * 100) : 0;
                    const ratio =
                      index === 0
                        ? "最省"
                        : cheapestMonthly > 0
                          ? `${(monthly / cheapestMonthly).toFixed(1)}×`
                          : null;
                    const cacheIgnored =
                      assumptions.cacheHitRate > 0 && price != null && price.cacheRead == null;

                    return (
                      <li
                        key={model.id}
                        className={`relative overflow-hidden rounded-lg border ${
                          index === 0 ? "border-ok/35" : "border-line"
                        }`}
                      >
                        <div
                          aria-hidden
                          className={`absolute inset-y-0 left-0 ${
                            index === 0 ? "bg-ok-soft" : "bg-sunk"
                          }`}
                          style={{ width: `${width}%` }}
                        />
                        <div className="relative p-3">
                          <div className="flex flex-wrap items-baseline justify-between gap-2">
                            <div className="flex items-center gap-1.5 text-[15px] font-medium">
                              {model.name}
                              {price?.status === "reported" && (
                                <span className="rounded bg-warn-soft px-1 text-xs font-normal text-warn">
                                  渠道价
                                </span>
                              )}
                            </div>
                            <div className="mono">
                              <span className="text-xl font-semibold tracking-tight text-accent-ink">
                                {formatMoney(monthly, currency)}
                              </span>
                              <span className="ml-1 text-[13px] text-ink-4">/ 月</span>
                              {monthly === 0 && (
                                <span className="ml-2 rounded bg-ok-soft px-1.5 py-0.5 text-xs text-ok">
                                  免费
                                </span>
                              )}
                              {ratio && (
                                <span className="ml-2 rounded bg-surface px-1.5 py-0.5 text-xs text-ink-3">
                                  {ratio}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[13px] text-ink-3 mono">
                            <span>单次 {formatMoney(result.perCall, currency)}</span>
                            <span>每日 {formatMoney(result.daily, currency)}</span>
                            <span>每千次 {formatMoney(result.perCall * 1000, currency)}</span>
                          </div>
                          <div
                            className="mt-1 text-xs leading-relaxed text-ink-4"
                            title={price?.note}
                          >
                            按 {vendorLabel(model.vendor)} 价{" "}
                            {price ? formatPrice(price.input, currency) : "—"} /{" "}
                            {price ? formatPrice(price.output, currency) : "—"} 每百万 token ·{" "}
                            {price?.verifiedAt ?? "日期未标"} {price ? priceStatusLabel(price.status) : ""}
                            {cacheIgnored && (
                              <span className="text-warn"> · 无缓存价，命中率按 0 计</span>
                            )}
                            {result.cacheApplied && (
                              <span className="text-ok"> · 缓存已生效</span>
                            )}
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>

                {priced.length >= 2 && cheapest && priciest && cheapestMonthly > 0 && (
                  <p className="mt-3 text-[15px] leading-relaxed text-ink-2">
                    最省 {cheapest.model.name} {formatMoney(cheapestMonthly, currency)}/月；最贵{" "}
                    {priciest.model.name}{" "}
                    {formatMoney(priciest.result?.monthly ?? 0, currency)}/月，
                    {priciest.result && priciest.result.monthly > cheapestMonthly ? (
                      <>
                        换成最省每月少花{" "}
                        {formatMoney(priciest.result.monthly - cheapestMonthly, currency)}（
                        {(priciest.result.monthly / cheapestMonthly).toFixed(1)} 倍）。
                      </>
                    ) : (
                      "两者同价。"
                    )}
                  </p>
                )}
              </>
            )}

            {unpriced.length > 0 && (
              <div className="mt-4 rounded-lg border border-dashed border-line p-3.5 text-[15px] text-ink-4">
                <p>当前币种无公开报价，未参与估算：</p>
                <ul className="mt-1 space-y-0.5">
                  {unpriced.map(({ model }) => (
                    <li key={model.id}>
                      {model.name} —{" "}
                      {currency === "CNY" && model.priceUsd
                        ? "有美元价，切到美元可估算"
                        : "无公开报价"}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <p className="mt-4 text-xs leading-relaxed text-ink-4">
              估算不含存储、向量库、网络与人力成本；阶梯价取最低档，批量推理、夜间折扣与免费额度均未计入；缓存命中只作用于输入
              token，且仅在型号提供缓存价时生效。
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}

function NumberField({
  label,
  value,
  min,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  step: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block">
      <span className="text-[13px] text-ink-3">{label}</span>
      <input
        type="number"
        inputMode="numeric"
        min={min}
        step={step}
        value={value}
        onChange={(e) => {
          const next = Number(e.target.value);
          onChange(Number.isFinite(next) ? Math.max(min, next) : min);
        }}
        className="mono mt-1 h-10 w-full rounded-lg border border-line bg-sunk px-2.5 text-[15px] text-ink outline-none transition focus:border-accent"
      />
    </label>
  );
}

function SliderField({
  label,
  value,
  min,
  max,
  step,
  display,
  hint,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  display: string;
  hint: string;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block">
      <span className="flex items-baseline justify-between text-[13px]">
        <span className="text-ink-3">{label}</span>
        <span className="mono font-medium text-ink-2">{display}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-2 w-full accent-accent"
      />
      <span className="mt-1 block text-xs leading-relaxed text-ink-4">{hint}</span>
    </label>
  );
}