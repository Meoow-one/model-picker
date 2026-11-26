import { NextResponse } from "next/server";
import { z } from "zod";
import { loadDataset } from "@/lib/data";
import type { Model } from "@/lib/types";
import {
  DEFAULT_MODEL,
  MAX_OUTPUT_TOKENS,
  MAX_TOOL_ROUNDS,
  SYSTEM_PROMPT,
  citationsFor,
  normalizeBaseUrl,
  runTool,
  TOOL_DEFINITIONS,
} from "@/lib/assistant";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ChatBodySchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().trim().min(1).max(4000),
      }),
    )
    .min(1)
    .max(24),
  model: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9._:/-]{1,80}$/)
    .optional(),
  baseUrl: z.string().trim().max(200).optional(),
});

type UpstreamToolCall = {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
};

type UpstreamMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: UpstreamToolCall[];
  tool_call_id?: string;
};

type UpstreamResponse = {
  choices?: { message?: UpstreamMessage }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
};

class UpstreamError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

// 单实例内存限流；公开部署请同时配置平台级 WAF/限流
const WINDOW_MS = 5 * 60_000;
const WINDOW_LIMIT = 30;
const hits = new Map<string, number[]>();

function allowRequest(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((at) => now - at < WINDOW_MS);
  if (recent.length >= WINDOW_LIMIT) {
    hits.set(ip, recent);
    return false;
  }
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 5000) {
    for (const [key, list] of hits) {
      if (list.every((at) => now - at >= WINDOW_MS)) hits.delete(key);
    }
  }
  return true;
}

// 仅在使用站点自己的 Key 时生效，防止公开访问被刷爆
let budgetDay = "";
let budgetTokens = 0;

function overBudget(): boolean {
  const day = new Date().toISOString().slice(0, 10);
  if (day !== budgetDay) {
    budgetDay = day;
    budgetTokens = 0;
  }
  const limit = Number(process.env.LLM_DAILY_TOKEN_BUDGET ?? 300_000);
  return Number.isFinite(limit) && limit > 0 ? budgetTokens >= limit : false;
}

function spendTokens(total: number) {
  budgetTokens += total;
}

function clientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "local";
}

function fail(status: number, code: string, message: string) {
  return NextResponse.json(
    { error: code, message },
    { status, headers: { "cache-control": "no-store" } },
  );
}

async function callUpstream(
  endpoint: string,
  apiKey: string,
  messages: UpstreamMessage[],
  model: string,
  useTools: boolean,
): Promise<UpstreamResponse> {
  let response: Response;
  try {
    response = await fetch(`${endpoint}/chat/completions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        ...(useTools
          ? { tools: TOOL_DEFINITIONS, tool_choice: "auto" }
          : { tool_choice: "none" }),
        temperature: 0.2,
        max_tokens: MAX_OUTPUT_TOKENS,
        stream: false,
      }),
      signal: AbortSignal.timeout(45_000),
    });
  } catch (error) {
    if (error instanceof Error && error.name === "TimeoutError") {
      throw new UpstreamError(504, "上游模型响应超时，请稍后重试。");
    }
    throw new UpstreamError(502, "无法连接上游模型服务，请检查网络或自定义端点。");
  }

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new UpstreamError(401, "密钥无效或没有该模型的权限（上游返回 401/403）。");
    }
    if (response.status === 429) {
      throw new UpstreamError(429, "上游模型限流（429），请稍后再试。");
    }
    throw new UpstreamError(502, `上游模型服务返回 ${response.status}。`);
  }

  try {
    return (await response.json()) as UpstreamResponse;
  } catch {
    throw new UpstreamError(502, "上游模型返回了无法解析的内容。");
  }
}

export async function GET() {
  return NextResponse.json(
    {
      serverKey: Boolean(process.env.DEEPSEEK_API_KEY?.trim()),
      defaultModel: DEFAULT_MODEL,
      maxOutputTokens: MAX_OUTPUT_TOKENS,
    },
    { headers: { "cache-control": "no-store" } },
  );
}

export async function POST(req: Request) {
  if (!allowRequest(clientIp(req))) {
    return fail(429, "rate_limited", "请求太频繁，请五分钟后再试。");
  }

  const declaredLength = Number(req.headers.get("content-length") ?? 0);
  if (declaredLength > 64 * 1024) {
    return fail(413, "too_large", "请求内容过长，请缩短对话历史。");
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail(400, "bad_request", "请求体不是合法 JSON。");
  }
  const parsed = ChatBodySchema.safeParse(body);
  if (!parsed.success) {
    return fail(400, "bad_request", "对话内容不合法：最多 24 条、每条 4000 字。");
  }

  const headerKey = req.headers.get("x-llm-key")?.trim() ?? "";
  const serverKey = process.env.DEEPSEEK_API_KEY?.trim() ?? "";
  const apiKey = headerKey || serverKey;
  if (!apiKey) {
    return fail(
      401,
      "missing_key",
      "尚未配置 API Key。请在「模型设置」里填写自己的密钥（只保存在本机浏览器）。",
    );
  }
  if (/\s/.test(apiKey) || apiKey.length > 256) {
    return fail(400, "invalid_key", "API Key 格式不正确。");
  }
  const usingServerKey = !headerKey && Boolean(serverKey);

  if (usingServerKey && overBudget()) {
    return fail(429, "budget_exceeded", "站点今日的免费额度已用完，请填写自己的 API Key 继续。");
  }

  const endpoint = normalizeBaseUrl(parsed.data.baseUrl);
  if (!endpoint) {
    return fail(400, "invalid_base_url", "自定义端点必须是 https 公网地址，且不能带账号密码。");
  }
  const model = parsed.data.model || DEFAULT_MODEL;

  let models: Model[];
  try {
    models = loadDataset().models;
  } catch {
    return fail(500, "data_unavailable", "站内数据读取失败，请稍后再试。");
  }

  const conversation: UpstreamMessage[] = [
    { role: "system", content: SYSTEM_PROMPT },
    ...parsed.data.messages.map((message) => ({
      role: message.role,
      content: message.content,
    })),
  ];

  const cited: string[] = [];
  let inputTokens = 0;
  let outputTokens = 0;
  let totalTokens = 0;

  try {
    for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
      const useTools = round < MAX_TOOL_ROUNDS;
      const data = await callUpstream(endpoint, apiKey, conversation, model, useTools);

      if (data.usage) {
        inputTokens += data.usage.prompt_tokens ?? 0;
        outputTokens += data.usage.completion_tokens ?? 0;
        totalTokens += data.usage.total_tokens ?? 0;
        if (usingServerKey) spendTokens(data.usage.total_tokens ?? 0);
      }

      const message = data.choices?.[0]?.message;
      if (!message) {
        throw new UpstreamError(502, "上游模型没有返回回答。");
      }

      const toolCalls = message.tool_calls ?? [];
      if (useTools && toolCalls.length > 0) {
        conversation.push({
          role: "assistant",
          content: message.content ?? "",
          tool_calls: toolCalls,
        });
        for (const call of toolCalls) {
          let args: unknown = {};
          try {
            args = JSON.parse(call.function.arguments || "{}");
          } catch {
            args = null;
          }
          const outcome =
            args === null
              ? {
                  result: {
                    error: "工具参数不是合法 JSON，请重新调用并传入合法参数。",
                  },
                  citedIds: [],
                }
              : runTool(call.function.name, args, models);
          cited.push(...outcome.citedIds);
          // 不能按字符数硬截断，截断的 JSON 会让模型读到坏数据
          const payload = JSON.stringify(outcome.result);
          conversation.push({
            role: "tool",
            tool_call_id: call.id,
            content:
              payload.length <= 30_000
                ? payload
                : JSON.stringify({
                    error: "工具结果过长，请缩小查询范围或减少条数后重新调用。",
                  }),
          });
        }
        continue;
      }

      const content = (message.content ?? "").trim();
      if (!content) {
        throw new UpstreamError(502, "上游模型返回了空回答，请换个问法重试。");
      }

      return NextResponse.json(
        {
          content,
          citations: citationsFor(cited, models),
          usage: { inputTokens, outputTokens, totalTokens },
        },
        { headers: { "cache-control": "no-store" } },
      );
    }

    throw new UpstreamError(502, "工具调用轮次过多，未能生成回答，请换个问法。");
  } catch (error) {
    if (error instanceof UpstreamError) {
      const code = error.status === 401 ? "invalid_key" : error.status === 429 ? "upstream_limited" : "upstream_error";
      return fail(error.status, code, error.message);
    }
    return fail(500, "internal_error", "服务端处理失败，请稍后重试。");
  }
}