import { describe, expect, it } from "vitest";
import { findBestMatch, normalizeName } from "../lib/normalize";

describe("normalizeName", () => {
  it("去掉供应商前缀、版本符号与批处理后缀", () => {
    expect(normalizeName("deepseek/deepseek-v4.1-flash")).toBe("deepseekv41flash");
    expect(normalizeName("z-ai/glm-5.3:batch")).toBe("glm53");
    expect(normalizeName("moonshotai/kimi-k3.1-pro:free")).toBe("kimik31pro");
  });

  it("不同命名风格在去掉分隔符后仍不冒充相等", () => {
    expect(normalizeName("DeepSeek V4.1 Flash 1017")).toBe("deepseekv41flash1017");
    expect(normalizeName("DeepSeek V4.1 Flash 1017")).not.toBe(normalizeName("deepseek-v4.1-flash"));
  });
});

describe("findBestMatch", () => {
  const entries = [
    { id: "qwen/qwen3.8-max" },
    { id: "qwen/qwen3.8-flash" },
    { id: "z-ai/glm-5.3" },
  ];
  const keyOf = (e: { id: string }) => e.id;

  it("完全相同归一化后命中 exact", () => {
    const m = findBestMatch("GLM-5.3", entries, keyOf);
    expect(m?.item.id).toBe("z-ai/glm-5.3");
    expect(m?.reason).toBe("exact");
  });

  it("只有前缀包含时不返回 exact", () => {
    const m = findBestMatch("Qwen3.8", entries, keyOf);
    expect(m?.reason).toBe("contains");
  });

  it("差距太大返回 null，不硬凑", () => {
    expect(findBestMatch("Doubao Seed 2.1 Pro", entries, keyOf)).toBeNull();
  });
});