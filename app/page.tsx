import Link from "next/link";
import { loadMeta } from "@/lib/data";

const ENTRIES = [
  {
    href: "/leaderboard",
    title: "看榜单",
    desc: "6 个场景子榜，按价格、上下文、能力筛选，勾选 2–4 个直接对比。",
    status: "已可用",
  },
  {
    href: "/calculator",
    title: "算成本",
    desc: "按日请求量、输入输出 token、缓存命中率估算月账单。",
    status: "已可用",
  },
  {
    href: "/chat",
    title: "问顾问",
    desc: "基于站内榜单与价格对话选型，支持填写自己的 API Key，密钥只存本机。",
    status: "已可用",
  },
  {
    href: "/method",
    title: "看口径",
    desc: "数据来源、币种与阶梯价口径、子榜规则和已知缺口。",
    status: "已可用",
  },
];

function loadMetaSafe() {
  try {
    return loadMeta();
  } catch {
    return null;
  }
}

export default function Home() {
  const meta = loadMetaSafe();

  return (
    <main className="mx-auto w-full max-w-[1400px] px-5 py-10 md:px-8 md:py-14">
      <div className="max-w-2xl">
        <p className="mono text-xs uppercase tracking-[0.18em] text-accent-ink">
          国内大模型 · 选型工作台
        </p>
        <h1 className="mt-3 text-[34px] font-semibold leading-tight tracking-tight md:text-[40px]">
          在国内大模型里，
          <br className="hidden sm:block" />
          找到你那个场景最划算的一个。
        </h1>
        <p className="mt-4 text-base leading-relaxed text-ink-3">
          先看每个模型在自己场景里的真实位置，再算它每月要花多少钱。价格逐条核对官方定价页，查不到官方价的型号不收。
        </p>
      </div>

      <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {ENTRIES.map((entry) => (
          <Link
            key={entry.title}
            href={entry.href}
            className="card group p-4 transition hover:border-accent/40 hover:shadow-float"
          >
            <div className="flex items-center justify-between">
              <span className="text-[17px] font-semibold">{entry.title}</span>
              <span className="rounded-full bg-ok-soft px-2 py-0.5 text-xs text-ok">
                {entry.status}
              </span>
            </div>
            <p className="mt-2 text-sm leading-relaxed text-ink-3">{entry.desc}</p>
            <span className="mt-3 inline-flex items-center gap-1 text-[13px] text-accent-ink opacity-0 transition group-hover:opacity-100">
              进入 →
            </span>
          </Link>
        ))}
      </div>

      <section className="card mt-4 p-5">
        <h2 className="text-sm font-semibold text-ink">数据状态</h2>
        {meta ? (
          <>
            <div className="mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="mono text-4xl font-semibold tracking-tight text-accent-ink">
                {meta.modelCount}
              </span>
              <span className="text-[15px] text-ink-3">个型号 · 更新于 {meta.updatedAt}</span>
            </div>
            <p className="mt-1 text-sm text-ink-4">
              人民币价：官方核验 {meta.cnyVerified} 个 · 第三方转引 {meta.cnyReported} 个 · 待补 0 个
            </p>
            <ul className="mt-4 divide-y divide-line border-t border-line text-sm">
              {meta.sources.map((source) => (
                <li key={source.name} className="flex items-center justify-between py-2.5">
                  <span className="text-ink-2">{source.name}</span>
                  <span className={source.ok ? "mono text-ok" : "mono text-danger"}>
                    {source.ok ? `${source.count} 条` : "失败"}
                  </span>
                </li>
              ))}
            </ul>
            {meta.warnings.length > 0 && (
              <details className="mt-4 rounded-lg bg-warn-soft px-3 py-2 text-sm text-warn">
                <summary className="cursor-pointer">{meta.warnings.length} 条数据警告</summary>
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  {meta.warnings.slice(0, 20).map((warning) => (
                    <li key={warning}>{warning}</li>
                  ))}
                </ul>
              </details>
            )}
          </>
        ) : (
          <p className="mt-3 text-sm text-ink-4">
            尚未生成数据，运行 <code className="rounded bg-sunk px-1 py-0.5 mono text-ink-2">npm run sync</code>。
          </p>
        )}
      </section>
    </main>
  );
}