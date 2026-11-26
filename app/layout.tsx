import type { Metadata } from "next";
import SiteSidebar from "@/components/SiteSidebar";
import IntroCover from "@/components/IntroCover";
import IntroReplay from "@/components/IntroReplay";
import AccountLink from "@/components/auth/AccountLink";
import { AuthProvider } from "@/components/auth/AuthProvider";
import { loadMeta } from "@/lib/data";
import "./globals.css";

export const metadata: Metadata = {
  title: "模型选型工作台",
  description: "面向 AI 产品经理的国内大模型选型工具：榜单、成本试算、数据可追溯",
};

// 首屏前定主题，避免先闪白再变黑
const THEME_SCRIPT = `(function(){try{var m=localStorage.getItem('mp-theme');var d=m==='dark'||((!m||m==='system')&&window.matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.dataset.theme=d?'dark':'light';}catch(e){document.documentElement.dataset.theme='light';}})();`;

function loadMetaSafe() {
  try {
    return loadMeta();
  } catch {
    return null;
  }
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const meta = loadMetaSafe();

  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-screen bg-bg text-ink antialiased">
        <AuthProvider>
          <div id="app-shell" className="md:grid md:grid-cols-[232px_minmax(0,1fr)]">
            <SiteSidebar modelCount={meta?.modelCount ?? null} updatedAt={meta?.updatedAt ?? null} />
            <div className="flex min-h-screen flex-col">
              <div className="flex-1">{children}</div>
              <footer className="border-t border-line">
                <div className="mx-auto max-w-[1400px] px-5 py-6 text-[13px] leading-relaxed text-ink-4 md:px-8">
                  <p>
                    数据来自各厂商公开定价页、models.dev、OpenRouter、LiteLLM，可能滞后，不构成采购建议。榜单与评测数据的版权归原机构。
                  </p>
                  <p className="mt-1">
                    价格单位统一为「元或美元 / 百万 token」；不做汇率换算，缺失值显示「—」。
                  </p>
                  <p className="mt-1">
                    账号为可选功能：登录后只保存你主动收藏、保存的对比与对话，可在账户页逐条删除；模型 API Key 不随账号上传。
                  </p>
                  <p className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
                    <AccountLink />
                    <IntroReplay />
                  </p>
                </div>
              </footer>
            </div>
          </div>
          <IntroCover modelCount={meta?.modelCount ?? null} />
        </AuthProvider>
      </body>
    </html>
  );
}