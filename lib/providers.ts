export const VENDOR_LABELS: Record<string, string> = {
  alibaba: "阿里云百炼",
  deepseek: "DeepSeek",
  zhipu: "智谱",
  moonshot: "月之暗面",
  bytedance: "字节火山方舟",
  minimax: "MiniMax",
  stepfun: "阶跃星辰",
  tencent: "腾讯混元",
  baidu: "百度文心",
  openai: "OpenAI",
  anthropic: "Anthropic",
  google: "Google",
};

/**
 * models.dev 的 cost 字段统一折算为美元 / 每百万 token。
 * 依据（2026-11-25 实测）：智谱 GLM-5.3 在 models.dev 为 1.19516/4.18306，
 * 官方 bigmodel.cn 为 8/28 元，比值 6.694。因此人民币官方价必须单独采集
 * （data/prices-cny.json），不能直接使用 models.dev 数值标成人民币。
 */
export const MODELSDEV_CURRENCY = "USD" as const;

export const SOURCES = {
  modelsdev: {
    name: "models.dev",
    url: "https://models.dev/api.json",
    kind: "price-and-capabilities",
  },
  openrouter: {
    name: "OpenRouter",
    url: "https://openrouter.ai/api/v1/models",
    kind: "scores-and-cross-check",
  },
  litellm: {
    name: "LiteLLM",
    url: "https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json",
    // 国内网络环境下 raw.githubusercontent 常被阻断，优先走 jsdelivr CDN
    mirrorUrl:
      "https://cdn.jsdelivr.net/gh/BerriAI/litellm@main/model_prices_and_context_window.json",
    kind: "price-cross-check",
  },
} as const;