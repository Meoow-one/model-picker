import LoginForm from "@/components/auth/LoginForm";

export const metadata = {
  title: "登录 / 注册 · 模型选型工作台",
  description: "可选账号：保存收藏型号、对比清单与顾问对话历史。",
};

export default function LoginPage() {
  return (
    <main className="mx-auto w-full max-w-[640px] px-5 py-10 md:px-8 md:py-14">
      <LoginForm />
    </main>
  );
}