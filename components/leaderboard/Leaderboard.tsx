"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/auth/AuthProvider";
import LoginGate from "@/components/auth/LoginGate";
import { addFavorite, listFavorites, removeFavorite, saveComparison } from "@/lib/account";
import { accountErrorMessage } from "@/lib/account-utils";
import type { Model } from "@/lib/types";
import {
  DEFAULT_FILTERS,
  benchmarkMeta,
  boardSpecs,
  filterModels,
  formatContext,
  formatMonth,
  formatPrice,
  formatScore,
  getBoardSpec,
  isForeign as isForeignModel,
  overallBenchmarkId,
  priceIn,
  resolveBoard,
  priceStatusLabel,
  sortModels,
  vendorLabel,
  type BenchmarkMeta,
  type Board,
  type BoardId,
  type CapKey,
  type Currency,
  type Filters,
  type SortKey,
  type SortState,
  type Weights,
} from "@/lib/leaderboard";

type Props = {
  models: Model[];
  updatedAt: string;
  sourcesOk: number;
  sourcesTotal: number;
  benchmarks: BenchmarkMeta[];
};

const CAP_LABELS: { key: CapKey; label: string }[] = [
  { key: "toolCall", label: "工具调用" },
  { key: "reasoning", label: "推理" },
  { key: "vision", label: "视觉" },
  { key: "cache", label: "上下文缓存" },
];

const CONTEXT_OPTIONS = [
  { value: 0, label: "不限" },
  { value: 32_768, label: "≥ 32K" },
  { value: 131_072, label: "≥ 128K" },
  { value: 262_144, label: "≥ 256K" },
  { value: 1_000_000, label: "≥ 1M" },
];

const PRICE_OPTIONS = [
  { value: null, label: "不限" },
  { value: 1, label: "< 1" },
  { value: 5, label: "< 5" },
  { value: 20, label: "< 20" },
];

export default function Leaderboard({
  models,
  updatedAt,
  sourcesOk,
  sourcesTotal,
  benchmarks,
}: Props) {
  const [boardId, setBoardId] = useState<BoardId>("overall");
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [sort, setSort] = useState<SortState | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [compareOpen, setCompareOpen] = useState(false);
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [favoriteBusy, setFavoriteBusy] = useState<string | null>(null);
  const [favoriteError, setFavoriteError] = useState<string | null>(null);
  const [gateOpen, setGateOpen] = useState(false);

  // ?q= 来自顾问引用；?compare= 来自账户页保存的对比清单
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const q = params.get("q");
    if (q) setFilters((prev) => ({ ...prev, query: q }));

    const raw = params.get("compare");
    if (!raw) return;
    const ids = raw
      .split(",")
      .map((id) => id.trim())
      .filter((id) => models.some((model) => model.id === id))
      .slice(0, 4);
    if (ids.length >= 2) {
      setSelected(ids);
      setCompareOpen(true);
    }
  }, [models]);

  useEffect(() => {
    if (!userId) {
      setFavorites(new Set());
      setFavoriteError(null);
      return;
    }
    let active = true;
    listFavorites(userId)
      .then((rows) => {
        if (active) setFavorites(new Set(rows.map((row) => row.model_id)));
      })
      .catch((err) => {
        if (active) setFavoriteError(accountErrorMessage(err));
      });
    return () => {
      active = false;
    };
  }, [userId]);

  const board = useMemo(() => resolveBoard(getBoardSpec(boardId), models), [boardId, models]);
  const basis = benchmarkMeta(benchmarks, board.activeBenchmark ?? board.basisBenchmark);
  const currency = filters.currency;

  const rows = useMemo(
    () => sortModels(filterModels(models, filters), board, currency, sort),
    [models, filters, board, currency, sort],
  );

  const vendors = useMemo(() => {
    const counts = new Map<string, number>();
    for (const model of models) {
      if (!filters.includeForeign && isForeignModel(model)) continue;
      counts.set(model.vendor, (counts.get(model.vendor) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [models, filters.includeForeign]);

  const selectedModels = useMemo(
    () =>
      selected
        .map((id) => models.find((m) => m.id === id))
        .filter((m): m is Model => m != null),
    [selected, models],
  );

  function update(patch: Partial<Filters>) {
    setFilters((prev) => ({ ...prev, ...patch }));
  }

  function toggleVendor(vendor: string) {
    setFilters((prev) => ({
      ...prev,
      vendors: prev.vendors.includes(vendor)
        ? prev.vendors.filter((v) => v !== vendor)
        : [...prev.vendors, vendor],
    }));
  }

  function toggleCap(cap: CapKey) {
    setFilters((prev) => ({
      ...prev,
      caps: prev.caps.includes(cap) ? prev.caps.filter((c) => c !== cap) : [...prev.caps, cap],
    }));
  }

  function toggleSelected(id: string) {
    setSelected((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 4) return prev;
      return [...prev, id];
    });
  }

  function handleSort(key: SortKey) {
    setSort((prev) => {
      if (prev?.key === key) return { key, dir: prev.dir === "asc" ? "desc" : "asc" };
      return { key, dir: key === "rank" ? board.dir : key === "release" ? "desc" : "desc" };
    });
  }

  async function toggleFavorite(modelId: string) {
    if (!userId) {
      setGateOpen(true);
      return;
    }
    const currentlyFavorite = favorites.has(modelId);
    setFavoriteBusy(modelId);
    setFavoriteError(null);
    try {
      if (currentlyFavorite) {
        await removeFavorite(userId, modelId);
        setFavorites((prev) => {
          const next = new Set(prev);
          next.delete(modelId);
          return next;
        });
      } else {
        await addFavorite(userId, modelId);
        setFavorites((prev) => new Set(prev).add(modelId));
      }
    } catch (err) {
      setFavoriteError(accountErrorMessage(err));
    } finally {
      setFavoriteBusy(null);
    }
  }

  function switchBoard(id: BoardId) {
    setBoardId(id);
    setSort(null);
  }

  const hasFilters =
    filters.query !== "" ||
    filters.vendors.length > 0 ||
    filters.weights !== "all" ||
    filters.minContext !== 0 ||
    filters.maxInput != null ||
    filters.caps.length > 0 ||
    filters.includeForeign;

  const scoreHeader =
    board.id === "value" ? `分/${currency === "CNY" ? "元" : "$"}` : board.scoreLabel;

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">榜单</h1>
          <p className="mt-1.5 text-sm text-ink-4">
            {models.filter((m) => !isForeignModel(m)).length} 个国内型号 ·{" "}
            {models.filter(isForeignModel).length} 个国际参照 · 数据更新于 {updatedAt} ·
            <span className={sourcesOk === sourcesTotal ? "text-ok" : "text-warn"}>
              {" "}
              {sourcesOk}/{sourcesTotal} 源正常
            </span>
          </p>
        </div>
        <div className="flex flex-none items-center gap-0.5 rounded-full border border-line bg-surface-2 p-0.5" role="group" aria-label="币种">
          {(
            [
              ["CNY", "人民币"],
              ["USD", "美元"],
            ] as [Currency, string][]
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => update({ currency: value, includeForeign: value === "USD" ? true : filters.includeForeign })}
              aria-pressed={currency === value}
              className={`h-8 rounded-full px-3 text-[13px] transition ${
                currency === value
                  ? "bg-surface font-semibold text-ink shadow-card"
                  : "text-ink-4 hover:text-ink"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <nav className="mt-5 flex gap-1 overflow-x-auto pb-px" aria-label="场景子榜">
        {boardSpecs().map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => switchBoard(item.id)}
            aria-pressed={boardId === item.id}
            className={`h-10 whitespace-nowrap rounded-full border px-4 text-sm transition ${
              boardId === item.id
                ? "border-line bg-surface font-semibold text-ink shadow-card"
                : "border-transparent text-ink-3 hover:bg-sunk hover:text-ink"
            }`}
            title={item.question}
          >
            {item.label}
          </button>
        ))}
      </nav>

      {board.banner && (
        <p className="mt-4 rounded-lg border border-line bg-warn-soft px-4 py-3 text-[13px] leading-relaxed text-warn">
          {board.banner}
        </p>
      )}

      <section className="card mt-4">
        <div className="flex flex-wrap items-center gap-2 border-b border-line p-3">
          <input
            value={filters.query}
            onChange={(e) => update({ query: e.target.value })}
            placeholder="搜索型号 / 厂商（模糊）"
            title="忽略大小写与空格，可容忍单个字母的缺漏或错写"
            className="h-9 w-52 rounded-lg border border-line bg-sunk px-2.5 text-sm text-ink outline-none transition placeholder:text-ink-4 focus:border-accent"
          />
          <select
            value={filters.weights}
            onChange={(e) => update({ weights: e.target.value as Weights })}
            className="h-9 rounded-lg border border-line bg-sunk px-2 text-sm text-ink-2 outline-none focus:border-accent"
            aria-label="开源权重"
          >
            <option value="all">开源/闭源不限</option>
            <option value="open">仅开源权重</option>
            <option value="closed">仅闭源</option>
          </select>
          <select
            value={filters.minContext}
            onChange={(e) => update({ minContext: Number(e.target.value) })}
            className="h-9 rounded-lg border border-line bg-sunk px-2 text-sm text-ink-2 outline-none focus:border-accent"
            aria-label="上下文下限"
          >
            {CONTEXT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                上下文{opt.value === 0 ? "不限" : opt.label}
              </option>
            ))}
          </select>
          <select
            value={filters.maxInput == null ? "" : String(filters.maxInput)}
            onChange={(e) => update({ maxInput: e.target.value === "" ? null : Number(e.target.value) })}
            className="h-9 rounded-lg border border-line bg-sunk px-2 text-sm text-ink-2 outline-none focus:border-accent"
            aria-label="输入价上限"
          >
            {PRICE_OPTIONS.map((opt) => (
              <option key={opt.label} value={opt.value == null ? "" : String(opt.value)}>
                输入价{opt.value == null ? "不限" : ` ${opt.label}`} {currency === "CNY" ? "¥" : "$"}/M
              </option>
            ))}
          </select>
          {CAP_LABELS.map((cap) => (
            <button
              key={cap.key}
              type="button"
              onClick={() => toggleCap(cap.key)}
              aria-pressed={filters.caps.includes(cap.key)}
              className={`h-9 rounded-full border px-3 text-[13px] transition ${
                filters.caps.includes(cap.key)
                  ? "border-transparent bg-accent-soft font-semibold text-accent-ink"
                  : "border-line text-ink-3 hover:text-ink"
              }`}
            >
              {cap.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() =>
              update({
                includeForeign: !filters.includeForeign,
                vendors: filters.includeForeign ? filters.vendors : [],
              })
            }
            aria-pressed={filters.includeForeign}
            title="把 OpenAI / Anthropic / Google 作为成本基准线一起显示（只有美元价）"
            className={`h-9 rounded-full border px-3 text-[13px] transition ${
              filters.includeForeign
                ? "border-transparent bg-accent-soft font-semibold text-accent-ink"
                : "border-line text-ink-3 hover:text-ink"
            }`}
          >
            含国际参照
          </button>
          {hasFilters && (
            <button
              type="button"
              onClick={() => setFilters(DEFAULT_FILTERS)}
              className="h-9 px-2 text-[13px] text-ink-4 underline-offset-4 hover:text-ink hover:underline"
            >
              重置
            </button>
          )}
          <span className="ml-auto text-[13px] text-ink-4">
            显示 {rows.length}/{models.length}
          </span>
        </div>

        <div className="flex flex-wrap gap-1.5 border-b border-line px-3 py-2">
          {vendors.map(([vendor, count]) => (
            <button
              key={vendor}
              type="button"
              onClick={() => toggleVendor(vendor)}
              aria-pressed={filters.vendors.includes(vendor)}
              className={`h-8 rounded-full border px-2.5 text-xs transition ${
                filters.vendors.includes(vendor)
                  ? "border-transparent bg-accent-soft font-semibold text-accent-ink"
                  : "border-line text-ink-3 hover:text-ink"
              }`}
            >
              {vendorLabel(vendor)}
              <span className="ml-1 opacity-60">{count}</span>
            </button>
          ))}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs text-ink-4">
                <th className="w-9 px-3 py-2.5">
                  <span className="sr-only">选择</span>
                </th>
                <th className="w-12 px-2 py-2.5 font-normal">
                  <SortButton label="名次" sortKey="rank" sort={sort} onSort={handleSort} />
                </th>
                <th className="px-2 py-2.5 font-normal">模型</th>
                <th className="w-20 px-2 py-2.5 font-normal">
                  <SortButton label="上下文" sortKey="context" sort={sort} onSort={handleSort} />
                </th>
                <th className="w-24 px-2 py-2.5 text-right font-normal">
                  <SortButton label={`输入 ${currency === "CNY" ? "¥" : "$"}`} sortKey="input" sort={sort} onSort={handleSort} align="right" />
                </th>
                <th className="w-20 px-2 py-2.5 text-right font-normal">
                  <SortButton label="输出" sortKey="output" sort={sort} onSort={handleSort} align="right" />
                </th>
                <th className="w-20 px-2 py-2.5 text-right font-normal">
                  <SortButton label="缓存读" sortKey="cache" sort={sort} onSort={handleSort} align="right" />
                </th>
                <th className="w-24 px-2 py-2.5 text-right font-normal">
                  <SortButton label={scoreHeader} sortKey="rank" sort={sort} onSort={handleSort} align="right" />
                </th>
                <th className="w-16 px-3 py-2.5 text-right font-normal">
                  <SortButton label="发布" sortKey="release" sort={sort} onSort={handleSort} align="right" />
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((model, index) => (
                <Row
                  key={model.id}
                  model={model}
                  index={index + 1}
                  board={board}
                  currency={currency}
                  selected={selected.includes(model.id)}
                  onToggle={() => toggleSelected(model.id)}
                  favorite={favorites.has(model.id)}
                  favoriteBusy={favoriteBusy === model.id}
                  onFavorite={() => void toggleFavorite(model.id)}
                />
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-3 py-10 text-center text-sm text-ink-4">
                    没有符合条件的型号。
                    <button
                      type="button"
                      onClick={() => setFilters(DEFAULT_FILTERS)}
                      className="ml-1 text-accent-ink underline underline-offset-4"
                    >
                      重置筛选
                    </button>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {favoriteError && (
          <p className="border-t border-line bg-warn-soft px-4 py-2 text-xs leading-relaxed text-warn">
            收藏状态同步失败：{favoriteError}
          </p>
        )}
        <div className="space-y-1 border-t border-line px-4 py-3 text-xs leading-relaxed text-ink-4">
          {basis && (
            <p>
              {board.activeBenchmark ? "本榜指标" : "分数依据"}：{basis.label} · 来源{" "}
              {basis.source} · 截至 {basis.asOf || "未标注"}
            </p>
          )}
          <p>
            价格单位：{currency === "CNY" ? "元" : "美元"} / 百万 token，官方常规档；阶梯价取最低档，悬停价格列可看档位说明与来源。
            国际模型默认隐藏，开启「含国际参照」后作为成本基准线出现——它们只有美元价，切到人民币时价格列显示「—」。
          </p>
          {!board.activeBenchmark && board.basisBenchmark && (
            <p>
              「综合分※」表示该子榜暂无专属指标，暂用综合榜同一指标排序（来源见上一行），不跨榜加权合并。
            </p>
          )}
          {filters.includeForeign && (
            <p>
              国际参照型号不在司南榜内，任何子榜的评测分都显示「—」；它们的 AA 分不混入本榜排名，只作跨榜参考。
            </p>
          )}
        </div>
      </section>

      {selected.length > 0 && (
        <div className="sticky bottom-4 z-30 mt-4 flex flex-wrap items-center gap-2 rounded-xl border border-line bg-raised px-3 py-2.5 text-sm shadow-float">
          <span className="text-ink-3">已选 {selected.length}/4</span>
          <div className="flex flex-wrap gap-1">
            {selectedModels.map((model) => (
              <button
                key={model.id}
                type="button"
                onClick={() => toggleSelected(model.id)}
                className="h-7 rounded-full bg-accent-soft px-2.5 text-xs text-accent-ink transition hover:brightness-95"
                title="移除"
              >
                {model.name} ×
              </button>
            ))}
          </div>
          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSelected([])}
              className="px-1.5 py-1 text-ink-4 transition hover:text-ink"
            >
              清空
            </button>
            <Link href={`/calculator?models=${selected.join(",")}`} className="btn-ghost">
              带入成本试算
            </Link>
            <button
              type="button"
              onClick={() => setCompareOpen(true)}
              disabled={selected.length < 2}
              className="btn-primary"
            >
              对比
            </button>
          </div>
        </div>
      )}

      {compareOpen && selectedModels.length >= 2 && (
        <CompareDialog
          models={selectedModels}
          currency={currency}
          onClose={() => setCompareOpen(false)}
        />
      )}

      <LoginGate
        open={gateOpen}
        onClose={() => setGateOpen(false)}
        feature="收藏型号"
      />
    </div>
  );
}

function SortButton({
  label,
  sortKey,
  sort,
  onSort,
  align,
}: {
  label: string;
  sortKey: SortKey;
  sort: SortState | null;
  onSort: (key: SortKey) => void;
  align?: "right";
}) {
  const active = sort?.key === sortKey;
  return (
    <button
      type="button"
      onClick={() => onSort(sortKey)}
      className={`inline-flex items-center gap-1 whitespace-nowrap transition hover:text-ink ${align === "right" ? "justify-end" : ""} ${
        active ? "font-medium text-ink" : ""
      }`}
    >
      {label}
      <span className={`text-[10px] ${active ? "opacity-100" : "opacity-40"}`}>
        {active ? (sort.dir === "asc" ? "▲" : "▼") : "↕"}
      </span>
    </button>
  );
}

function Row({
  model,
  index,
  board,
  currency,
  selected,
  onToggle,
  favorite,
  favoriteBusy,
  onFavorite,
}: {
  model: Model;
  index: number;
  board: Board;
  currency: Currency;
  selected: boolean;
  onToggle: () => void;
  favorite: boolean;
  favoriteBusy: boolean;
  onFavorite: () => void;
}) {
  const price = priceIn(model, currency);
  const score = board.score(model, currency);
  const ranked = board.rank(model, currency) != null;
  const scoreText =
    board.id === "value" && score != null ? score.toFixed(2) : formatScore(score, board.format);
  const priceNote = price
    ? `${priceStatusLabel(price.status)}${price.verifiedAt ? ` · ${price.verifiedAt}` : ""}\n${price.sourceUrl}${price.note ? `\n${price.note}` : ""}`
    : "该币种暂无公开价";

  return (
    <tr
      className={`border-b border-line last:border-0 transition-colors ${
        selected ? "bg-accent-soft" : "hover:bg-sunk"
      }`}
    >
      <td className="px-3 py-2.5 align-top">
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggle}
          aria-label={`选择 ${model.name}`}
          className="mt-1 h-3.5 w-3.5 accent-accent"
        />
      </td>
      <td className="mono px-2 py-2.5 align-top text-[13px] text-ink-4">
        {ranked ? String(index).padStart(2, "0") : <span className="text-ink-4 opacity-50">—</span>}
      </td>
      <td className="px-2 py-2.5 align-top">
        <div className="flex items-center gap-1.5 text-[15px] font-medium leading-5">
          {model.name}
          <button
            type="button"
            onClick={onFavorite}
            disabled={favoriteBusy}
            aria-pressed={favorite}
            aria-label={favorite ? `取消收藏 ${model.name}` : `收藏 ${model.name}`}
            title={favorite ? "取消收藏" : "收藏到账户（需登录）"}
            className={`grid h-6 w-6 flex-none place-items-center rounded-md transition disabled:opacity-40 ${
              favorite
                ? "text-accent-ink"
                : "text-ink-4 opacity-50 hover:bg-accent-soft hover:text-accent-ink hover:opacity-100"
            }`}
          >
            <StarIcon filled={favorite} />
          </button>
          {isForeignModel(model) && (
            <span className="rounded bg-sunk px-1 text-[11px] font-normal text-ink-3">
              参照
            </span>
          )}
        </div>
        <div className="mt-0.5 flex items-center gap-1.5 text-xs text-ink-4">
          <span>{vendorLabel(model.vendor)}</span>
          {model.openWeights && (
            <span className="rounded bg-accent-soft px-1 text-[11px] text-accent-ink">开源</span>
          )}
          <span className="opacity-40">|</span>
          <span>{model.capabilities.toolCall ? "可挂工具" : "无工具调用"}</span>
        </div>
      </td>
      <td className="mono px-2 py-2.5 align-top text-sm text-ink-3">
        {formatContext(model.contextWindow)}
      </td>
      <td className="mono px-2 py-2.5 text-right align-top text-sm text-ink-2" title={priceNote}>
        <span className={price ? "" : "text-ink-4 opacity-50"}>{formatPrice(price?.input, currency)}</span>
        {price?.status === "reported" && (
          <span
            className="ml-1 rounded bg-warn-soft px-1 align-middle text-[11px] text-warn"
            title="第三方转引，未核对厂商定价页"
          >
            渠道
          </span>
        )}
      </td>
      <td className="mono px-2 py-2.5 text-right align-top text-sm text-ink-2" title={priceNote}>
        <span className={price ? "" : "text-ink-4 opacity-50"}>{formatPrice(price?.output, currency)}</span>
      </td>
      <td className="mono px-2 py-2.5 text-right align-top text-sm" title={priceNote}>
        <span className={price?.cacheRead != null ? "text-ink-2" : "text-ink-4 opacity-50"}>
          {price?.cacheRead != null ? formatPrice(price.cacheRead, currency) : "—"}
        </span>
      </td>
      <td className="mono px-2 py-2.5 text-right align-top">
        <span
          className={
            score == null
              ? "text-[13px] font-normal text-ink-4 opacity-50"
              : "text-[17px] font-semibold tracking-tight text-accent-ink"
          }
        >
          {scoreText}
        </span>
      </td>
      <td className="mono px-3 py-2.5 text-right align-top text-xs text-ink-4">
        {formatMonth(model.releaseDate)}
      </td>
    </tr>
  );
}

function StarIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 3.6l2.55 5.17 5.7.83-4.13 4.03.98 5.68L12 16.62l-5.1 2.69.98-5.68L3.75 9.6l5.7-.83L12 3.6z" />
    </svg>
  );
}

function CompareDialog({
  models,
  currency,
  onClose,
}: {
  models: Model[];
  currency: Currency;
  onClose: () => void;
}) {
  const { user } = useAuth();
  const [saveName, setSaveName] = useState("未命名对比");
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [gateOpen, setGateOpen] = useState(false);

  const prices = models.map((m) => priceIn(m, currency)?.input ?? null);
  const known = prices.filter((p): p is number => p != null);
  const min = known.length ? Math.min(...known) : null;
  const overallId = overallBenchmarkId(models);
  const nextPath = `/leaderboard?compare=${encodeURIComponent(models.map((m) => m.id).join(","))}`;

  async function handleSave() {
    if (!user) {
      setGateOpen(true);
      return;
    }
    setSaving(true);
    setSaveMessage(null);
    setSaveError(null);
    try {
      const row = await saveComparison(
        user.id,
        saveName,
        models.map((m) => m.id),
      );
      setSaveMessage(`已保存「${row.name}」到账户`);
    } catch (err) {
      setSaveError(accountErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  const rows: { label: string; render: (model: Model) => React.ReactNode }[] = [
    { label: "厂商", render: (m) => vendorLabel(m.vendor) },
    {
      label: "综合分",
      render: (m) => {
        const hit = overallId
          ? m.scores.find((s) => s.benchmark === overallId)
          : undefined;
        if (!hit) return <span className="text-ink-4 opacity-50">—</span>;
        return (
          <span title={`${hit.source}${hit.asOf ? ` · ${hit.asOf}` : ""}`}>
            {hit.score.toFixed(1)}
          </span>
        );
      },
    },
    {
      label: `输入价 /M ${currency === "CNY" ? "¥" : "$"}`,
      render: (m) => {
        const p = priceIn(m, currency);
        if (!p) return <span className="text-ink-4 opacity-50">—</span>;
        const cheapest = min != null && p.input === min;
        return (
          <span className={cheapest ? "font-medium text-ok" : ""} title={p.note}>
            {formatPrice(p.input, currency)}
            {p.status === "reported" && <span className="ml-1 text-[11px] text-warn">渠道</span>}
          </span>
        );
      },
    },
    {
      label: "输出价 /M",
      render: (m) => formatPrice(priceIn(m, currency)?.output, currency),
    },
    {
      label: "缓存读",
      render: (m) => formatPrice(priceIn(m, currency)?.cacheRead, currency),
    },
    { label: "上下文", render: (m) => formatContext(m.contextWindow) },
    {
      label: "工具调用",
      render: (m) => (m.capabilities.toolCall ? "✓" : "—"),
    },
    { label: "推理", render: (m) => (m.capabilities.reasoning ? "✓" : "—") },
    { label: "视觉", render: (m) => (m.capabilities.vision ? "✓" : "—") },
    { label: "开源权重", render: (m) => (m.openWeights ? "是" : "否") },
    { label: "发布", render: (m) => formatMonth(m.releaseDate) },
    {
      label: "价格来源",
      render: (m) => {
        const p = priceIn(m, currency);
        if (!p) return <span className="text-ink-4 opacity-50">—</span>;
        return (
          <a
            href={p.sourceUrl}
            target="_blank"
            rel="noreferrer"
            className="text-[13px] text-accent-ink underline underline-offset-4 hover:text-accent"
          >
            {priceStatusLabel(p.status)}
          </a>
        );
      },
    },
  ];

  return (
    <>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="模型对比"
        className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-[#081120]/55 p-4 backdrop-blur-[2px] sm:p-8"
        onClick={onClose}
      >
      <div
        className="card w-full max-w-4xl p-5 shadow-float"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">对比</h2>
          <button
            type="button"
            onClick={onClose}
            className="h-8 rounded-lg px-2.5 text-[13px] text-ink-3 transition hover:bg-sunk hover:text-ink"
          >
            关闭
          </button>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[600px] text-sm">
            <thead>
              <tr className="border-b border-line text-left">
                <th className="w-28 px-2 py-2 font-normal text-ink-4">指标</th>
                {models.map((m) => (
                  <th key={m.id} className="px-2 py-2 font-semibold">
                    {m.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.label} className="border-b border-line last:border-0">
                  <td className="px-2 py-2 text-ink-3">{row.label}</td>
                  {models.map((m) => (
                    <td key={m.id} className="mono px-2 py-2 text-ink-2">
                      {row.render(m)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-ink-4">
          缺数据一律显示「—」，不做补零、不做汇率换算。价格为各厂商公开价，不含渠道折扣与批量优惠。
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-3">
          <input
            value={saveName}
            onChange={(event) => setSaveName(event.target.value)}
            maxLength={60}
            aria-label="对比清单名称"
            placeholder="给这次对比起个名字"
            className="h-9 min-w-[180px] flex-1 rounded-lg border border-line bg-sunk px-2.5 text-[13px] text-ink outline-none transition placeholder:text-ink-4 focus:border-accent"
          />
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving}
            className="btn-primary h-9 px-4 text-[13px]"
          >
            {saving ? "保存中…" : "保存到账户"}
          </button>
          {user && (
            <Link href="/account" className="text-[12px] text-accent-ink hover:underline">
              已保存的清单
            </Link>
          )}
        </div>
        {saveMessage && <p className="mt-2 text-[12px] text-ok">{saveMessage}</p>}
        {saveError && <p className="mt-2 text-[12px] text-danger">{saveError}</p>}
        <p className="mt-1 text-[11px] text-ink-4">
          {user
            ? "保存后可在账户页打开或删除。"
            : "保存需要登录；浏览、筛选和对比本身不需要账号。"}
        </p>
      </div>
      </div>
      <LoginGate
        open={gateOpen}
        onClose={() => setGateOpen(false)}
        feature="保存对比清单"
        nextPath={nextPath}
      />
    </>
  );
}