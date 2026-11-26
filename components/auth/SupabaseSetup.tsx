const ENV_SNIPPET = `NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...`;

export default function SupabaseSetup() {
  return (
    <section className="rounded-xl border border-line bg-surface-2 p-4">
      <h2 className="text-[15px] font-semibold text-ink">还差一步：连接 Supabase</h2>
      <p className="mt-1.5 text-[13px] leading-relaxed text-ink-3">
        账号、收藏、对比清单和对话历史都存在你自己的 Supabase 项目里。没配置之前，浏览、榜单和成本试算不受影响。
      </p>
      <ol className="mt-3 list-decimal space-y-2 pl-5 text-[13px] leading-relaxed text-ink-2">
        <li>在 supabase.com 新建一个项目（免费档够用）。</li>
        <li>
          Project Settings → API（新版控制台叫 API Keys），复制 Project URL 和 anon / publishable key。
        </li>
        <li>
          在项目根目录的 <code className="mono rounded bg-sunk px-1">.env.local</code> 写入下面两行，然后重启
          dev server。
        </li>
        <li>
          打开 Supabase SQL Editor，运行项目里的{" "}
          <code className="mono rounded bg-sunk px-1">supabase/schema.sql</code>，建表并启用 RLS。
        </li>
      </ol>
      <pre className="mono mt-3 overflow-x-auto rounded-lg bg-sunk p-3 text-[11px] leading-relaxed text-ink-2">
        {ENV_SNIPPET}
      </pre>
      <p className="mt-3 text-[11px] leading-relaxed text-ink-4">
        本地开发如果不想收验证邮件，可在 Authentication → Providers → Email 关掉 Confirm email；正式公开建议保持开启。
        anon key 本来就是公开的，安全依赖 RLS；不要把这个项目换成 service_role key。
      </p>
    </section>
  );
}