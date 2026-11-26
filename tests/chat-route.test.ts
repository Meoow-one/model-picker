import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "../app/api/chat/route";

function chatRequest(body: unknown, key = "sk-test-1234567890"): Request {
  return new Request("http://localhost:3000/api/chat", {
    method: "POST",
    headers: { "content-type": "application/json", "x-llm-key": key },
    body: JSON.stringify(body),
  });
}

function upstream(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json" },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("/api/chat 路由", () => {
  it("执行工具调用，再把工具结果交回模型并返回引用", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        upstream({
          choices: [
            {
              message: {
                role: "assistant",
                content: "",
                tool_calls: [
                  {
                    id: "call_1",
                    type: "function",
                    function: {
                      name: "search_models",
                      arguments: JSON.stringify({ vendors: ["deepseek"] }),
                    },
                  },
                ],
              },
            },
          ],
          usage: { prompt_tokens: 100, completion_tokens: 20, total_tokens: 120 },
        }),
      )
      .mockResolvedValueOnce(
        upstream({
          choices: [
            {
              message: {
                role: "assistant",
                content: "站内 DeepSeek 系列有 3 个型号，输入价从低到高排列。",
              },
            },
          ],
          usage: { prompt_tokens: 300, completion_tokens: 40, total_tokens: 340 },
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(
      chatRequest({ messages: [{ role: "user", content: "DeepSeek 有哪些型号？" }] }),
    );
    expect(response.status).toBe(200);
    const data = (await response.json()) as {
      content: string;
      citations: { id: string; name: string }[];
      usage: { totalTokens: number };
    };

    expect(data.content).toContain("DeepSeek");
    expect(data.citations.length).toBeGreaterThan(0);
    expect(data.citations.every((c) => c.id.startsWith("deepseek"))).toBe(true);
    expect(data.usage.totalTokens).toBe(460);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    const secondCall = fetchMock.mock.calls[1][1] as RequestInit;
    const sent = JSON.parse(String(secondCall.body)) as {
      messages: { role: string; content: string }[];
    };
    expect(sent.messages.some((m) => m.role === "tool")).toBe(true);
    expect(sent.messages.at(-1)?.content).toContain("deepseek-v4-pro");
  });

  it("没有 Key 时不请求上游，直接返回 401", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(chatRequest({ messages: [{ role: "user", content: "你好" }] }, ""));
    expect(response.status).toBe(401);
    expect(((await response.json()) as { error: string }).error).toBe("missing_key");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("拒绝 http / 内网自定义端点", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(
      chatRequest({
        messages: [{ role: "user", content: "你好" }],
        baseUrl: "http://127.0.0.1:8080/v1",
      }),
    );
    expect(response.status).toBe(400);
    expect(((await response.json()) as { error: string }).error).toBe("invalid_base_url");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("上游 401 映射为 invalid_key，不透传上游原文", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(upstream({ error: "bad key" }, 401)));

    const response = await POST(chatRequest({ messages: [{ role: "user", content: "你好" }] }));
    expect(response.status).toBe(401);
    const data = (await response.json()) as { error: string; message: string };
    expect(data.error).toBe("invalid_key");
    expect(data.message).not.toContain("bad key");
  });
});