import AssistantChat from "@/components/chat/AssistantChat";
import { loadDataset } from "@/lib/data";

export const metadata = {
  title: "选型顾问 · 模型选型工作台",
  description: "基于站内榜单与价格数据的对话式选型顾问，支持用户自带 OpenAI 兼容 API Key。",
};

export default function ChatPage() {
  const { models } = loadDataset();

  return (
    <main className="mx-auto w-full max-w-[1100px] px-5 py-8 md:px-8">
      <AssistantChat modelCount={models.length} />
    </main>
  );
}