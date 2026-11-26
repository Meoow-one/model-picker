import AccountView from "@/components/account/AccountView";
import { loadDataset } from "@/lib/data";

export const metadata = {
  title: "账户 · 模型选型工作台",
  description: "查看收藏型号、保存的对比清单和顾问对话历史。",
};

export default function AccountPage() {
  const { models } = loadDataset();

  return (
    <main className="mx-auto w-full max-w-[1100px] px-5 py-8 md:px-8">
      <AccountView models={models} />
    </main>
  );
}