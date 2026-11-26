import Leaderboard from "@/components/leaderboard/Leaderboard";
import { loadDataset, loadMeta } from "@/lib/data";

export const metadata = {
  title: "榜单 · 模型选型工作台",
  description: "国内主流大模型的场景化榜单：综合能力、代码、中文长文、RAG、性价比、高速低价。",
};

export default function LeaderboardPage() {
  const { models } = loadDataset();
  const meta = loadMeta();
  const sourcesOk = meta.sources.filter((s) => s.ok).length;

  return (
    <main className="mx-auto w-full max-w-[1400px] px-5 py-8 md:px-8">
      <Leaderboard
        models={models}
        updatedAt={meta.updatedAt}
        sourcesOk={sourcesOk}
        sourcesTotal={meta.sources.length}
        benchmarks={meta.benchmarks}
      />
    </main>
  );
}