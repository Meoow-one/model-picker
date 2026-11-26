import { describe, expect, it } from "vitest";
import {
  accountErrorMessage,
  authErrorMessage,
  parseCitations,
  safeNext,
  threadTitle,
  userLabel,
} from "@/lib/account-utils";

describe("safeNext", () => {
  it("接受站内路径并保留查询参数", () => {
    expect(safeNext("/leaderboard?compare=a%2Cb")).toBe("/leaderboard?compare=a%2Cb");
    expect(safeNext("/account")).toBe("/account");
  });

  it("拒绝协议相对地址、完整 URL 和登录页回跳", () => {
    expect(safeNext("//evil.example")).toBe("/");
    expect(safeNext("https://evil.example")).toBe("/");
    expect(safeNext("/\\evil.example")).toBe("/");
    expect(safeNext("/login")).toBe("/");
    expect(safeNext(null)).toBe("/");
  });

  it("超长 next 回退到首页", () => {
    expect(safeNext(`/${"a".repeat(600)}`)).toBe("/");
  });
});

describe("userLabel", () => {
  it("优先用显示名，缺失时用邮箱前缀", () => {
    expect(userLabel({ email: "a@b.com", user_metadata: { display_name: " 鲁婷 " } })).toBe("鲁婷");
    expect(userLabel({ email: "luting@example.com", user_metadata: {} })).toBe("luting");
    expect(userLabel(null)).toBe("账户");
  });
});

describe("threadTitle", () => {
  it("压缩空白并在超长时截断", () => {
    expect(threadTitle("  客服   机器人\n怎么选  ")).toBe("客服 机器人 怎么选");
    expect(threadTitle("一".repeat(45))).toBe(`${"一".repeat(40)}…`);
    expect(threadTitle("   ")).toBe("新的选型对话");
  });
});

describe("authErrorMessage", () => {
  it("映射常见认证错误", () => {
    expect(authErrorMessage("Invalid login credentials")).toContain("邮箱或密码");
    expect(authErrorMessage("Email not confirmed")).toContain("验证邮件");
    expect(authErrorMessage("User already registered")).toContain("已经注册");
    expect(authErrorMessage("Password should be at least 8 characters")).toContain("至少 8");
    expect(authErrorMessage("rate limit exceeded")).toContain("太频繁");
    expect(authErrorMessage("something unexpected")).toBe("操作失败，请稍后重试。");
  });
});

describe("accountErrorMessage", () => {
  it("提示建表缺失而不是泄露原始 SQL 错误", () => {
    expect(accountErrorMessage(new Error('relation "favorites" does not exist'))).toContain(
      "supabase/schema.sql",
    );
  });

  it("保留应用层可读错误", () => {
    expect(accountErrorMessage(new Error("这条对话不存在或不属于当前账户。"))).toContain(
      "不属于当前账户",
    );
    expect(accountErrorMessage(new Error("至少选择 2 个型号"))).toContain("2 个型号");
  });
});

describe("parseCitations", () => {
  it("只接受结构完整的引用，忽略脏数据", () => {
    expect(
      parseCitations([
        { id: "qwen", name: "Qwen", vendor: "阿里" },
        { id: 1, name: "bad" },
        null,
        "x",
      ]),
    ).toEqual([{ id: "qwen", name: "Qwen", vendor: "阿里" }]);
    expect(parseCitations(null)).toEqual([]);
  });
});