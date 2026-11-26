import CostCalculator from "@/components/cost/CostCalculator";
import { loadDataset, loadMeta } from "@/lib/data";

export const metadata = {
  title: "成本试算 · 模型选型工作台",
  description: "按日请求量、输入输出 token、缓存命中率与重试率，估算国内大模型的月账单。",
};

export default function CalculatorPage() {
  const { models } = loadDataset();
  const meta = loadMeta();

  return (
    <main className="mx-auto w-full max-w-[1400px] px-5 py-8 md:px-8">
      <CostCalculator models={models} updatedAt={meta.updatedAt} />
    </main>
  );
}