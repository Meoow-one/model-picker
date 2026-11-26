# 模型选型工作台 · 开发计划

> 版本：v1.1（2026-11-25）
> 状态：范围已确认，M0 可开工。DeepSeek Key 不阻塞 M0–M3，M4 前提供即可。

---

## 0. 一句话定位

给初级 AI 产品经理用的**国内大模型选型工作台**：一个可信的榜单看板 + 一个能算出真金白银的 Token 成本试算器 + 一个基于站内数据的选型顾问。

不是"又一个模型排行榜"，差异点在**每一行数据都能追溯到官方来源和更新时间**，以及**看完榜能立刻算出自己业务要花多少钱**。

---

## 1. 用户与目标

### 1.1 用户画像

| | 主要用户 | 次要用户 |
|---|---|---|
| 是谁 | 初级 AIPM（含你自己）、转型中的产品经理 | 面试官 / 同行（作品集场景） |
| 痛点 | 榜单看不懂口径、价格按 token 报价算不出月成本、名字对不上（同一个 Qwen 有 8 个变体）、不知道选完怎么向老板解释 | 想快速判断这个人的方法论是否扎实 |
| 现有替代 | 逐个翻厂商文档 + 收藏夹里散落的榜单截图 + Excel 手算 | — |

### 1.2 成功标准（可验证，不是口号）

1. **10 分钟闭环**：从"我要做一个客服机器人"到"选出 2 个候选 + 知道月成本 + 能说出为什么"，单个流程 ≤ 10 分钟。
2. **数据可信**：任意一行榜单数据可点开看到「来源 + 抓取时间」；成本试算结果与一次真实的 100 次调用对账，误差 < 5%。
3. **可持续**：连续 4 周无人值守自动更新，至少 3 次成功、失败时有告警且页面不崩（降级到上次快照）。
4. **可讲述**：方法论页能解释清楚「为什么综合分不能跨榜比较」「为什么缓存价要单独算」——这两点足以在面试中区分"做过"和"想过"。

### 1.3 非目标（本期明确不做）

- 不做模型评测本身（不自建测试集、不跑 benchmark）
- 不做 API 网关 / 代理转发（不是 one-api）
- 不做团队协作与付费；账号为**可选功能**（Supabase），只服务收藏 / 对比清单 / 对话历史，匿名浏览全功能可用（2026-11-26 调整，见 §7.6）
- 不做英文站、不做移动端 App
- 不做"AI 自动选型一句话结论"（对话只做辅助，结论必须由用户确认）

---

## 2. 范围：模型与子榜

### 2.1 模型范围

聚焦**国内可商用 API 的文本 LLM**，首版纳入 **42 个国内模型 + 3 个国际参照**（清单见附录 A；无官方定价的型号已剔除）：

- 阿里 Qwen 系列（通义百炼）
- DeepSeek 系列
- 智谱 GLM 系列
- 月之暗面 Kimi 系列
- 字节豆包（火山方舟）
- MiniMax、阶跃 Step、腾讯混元、百度文心
- 另保留 OpenAI / Claude / Gemini 各 1–2 个作为**成本基准线**（回答"比 GPT 便宜多少"必须有参照）

排除（v1）：Embedding / Rerank / 图像 / 语音 / 私有化部署模型。这些的选型维度完全不同（显存、License、QPS），塞进同一张表会污染对比。

### 2.2 子榜设计（不照搬参考站的"学科分类"）

参考站用「综合/编程/科研/办公/知识问答」是按**学科**分。PM 选型是按**场景**分，所以调整为：

| 子榜 | 对应真实决策 | 主要参考基准 |
|---|---|---|
| 综合能力 | 不知道选什么时的起点 | 各榜综合分 + 价格 |
| 代码与工具调用 | 做 Coding Agent / 工作流编排 | SWE-bench、τ²-Bench |
| 中文写作与长文 | 内容生成、公文、摘要 | SuperCLUE 中文、长上下文评测 |
| 知识问答 / RAG | 企业知识库、客服 | 事实性评测、上下文长度 |
| 性价比 | 预算受限时的第一筛选 | 综合分 ÷ 价格 |
| 高速低价 | 高并发轻任务、分类打标 | 延迟、输出速度、单价 |

**硬规则：不做跨榜合并总分。** 不同机构的口径、题目、版本都不可比，合并出来的数字没有解释力。页面只做并排展示 + 各自标注来源与日期。这条要写进方法论页。

---

## 3. 产品结构

```
/                    首页：今日数据概览（更新于/收录数/降价提醒）+ 三个入口
/leaderboard         榜单：子榜 tab + 筛选 + 排序 + 勾选对比（核心页）
/models/[slug]       模型详情：价格阶梯、能力开关、评测来源、官方文档链接
/compare             对比：最多 4 个模型，指标对齐 + 缺数据明确标"—"
/calculator          成本试算：输入业务量 → 月成本排序 + 差额
/chat                选型顾问：对话 + 工具调用 + 引用卡片
/login               登录 / 注册（可选账号，Supabase Auth）
/account             账户页：收藏、对比清单、对话历史
/method              方法论：选型维度、榜单口径、局限与免责
```

### 主流程

```
看榜（/leaderboard）
  → 勾选 3 个模型
  → 进 /compare 对齐价格与能力
  → 带入 /calculator 算月成本
  → 得出结论（v1：复制文本摘要；v2：导出报告）
```

对话入口独立，但对话产出的"选型卡"可以一键加入对比 —— 两条路要能汇合。

---

## 4. 数据层设计（项目核心，占工程量 50%）

### 4.1 数据源清单（本机已实测）

| 源 | 接口 | 实测 | 覆盖 | 用途 | 风险 |
|---|---|---|---|---|---|
| models.dev | `https://models.dev/api.json` | ✅ 200 / 6.9 MB / 免 key | 326 家供应商，含 `alibaba-cn`、`zhipuai`、`moonshotai-cn`、`volcengine`、`siliconflow-cn`、`stepfun`、`minimax-cn` | **主数据层**：上下文、模态、推理开关、工具调用、知识截止、每百万 token 价格 | 已实测：cost **统一折算为美元**，不是人民币；部分模型 cost 为 0（未填） |
| OpenRouter | `https://openrouter.ai/api/v1/models` | ✅ 200 / 0.9 MB / 免 key | 470 个模型，102 个国产，**自带 `benchmarks.artificial_analysis`** | 交叉校验 + **L2 评测分来源**（AA 智能/编程/Agent 指数） | 价格是渠道零售价（实测个别模型比官方高 94%），只作参考 |
| LiteLLM | `model_prices_and_context_window.json` | ✅ 200 / 5.2 MB（raw 被墙，走 jsdelivr 镜像） | 7165 条，1778 条国产，**每条带 `source` 官方定价文档 URL** | 价格旁证 + 生成"官方来源"链接 | 命名体系不同，只做精确名称匹配，不硬凑 |
| OpenCompass（司南） | `rank.opencompass.org.cn` | ✅ 200 | 中文评测分 | 代码/知识/综合子榜分数 | 页面结构可能变，必须解析容错 |
| SuperCLUE | `superclueai.com` | ✅ 200 | 中文能力评测 | 中文写作/知识子榜 | 同上 |
| LMArena | `lmarena.ai` | ❌ 000（不可达） | 人类偏好 Elo | 原计划的人类偏好分 | **本机跑不通**。需改用第三方聚合镜像或人工录入快照，禁止把"实时爬 LMArena"写进流水线 |
| 厂商官方定价页 | 各厂商文档 | ✅ | 权威价格 | 人工/半自动定期校验 | 改版频繁，只做校验不做唯一来源 |

> 关键结论：**能用 API 的绝不爬页面**。API 拿硬数据（价格、上下文、能力）。爬虫只用于拿不到 API 的评测分，且必须失败降级。

### 4.2 三层数据模型

```
L1 硬数据（自动，每日/每周）      ← models.dev + OpenRouter + LiteLLM
   价格、上下文、模态、工具调用、推理、知识截止、发布日期
L2 评测分（自动爬 + 人工复核）     ← OpenCompass / SuperCLUE / 第三方镜像
   分基准分数、榜单名次、来源版本日期
L3 策展数据（纯人工，最慢但最值钱） ← 你自己
   场景标签、适用/不适用、踩坑备注、中文实测口碑、合规提示
```

L3 是这个站区别于"又一个爬虫站"的地方。建议首版只人工策展 20 个高频模型，每条 2–3 句，宁可少而准。

### 4.3 统一模型 Schema（`data/models.json`）

```jsonc
{
  "id": "deepseek-v4-flash",              // canonical slug，全站主键
  "name": "DeepSeek V4.1 Flash",
  "vendor": "deepseek",
  "family": "deepseek-flash",
  "aliases": ["deepseek/deepseek-v4.1-flash", "DeepSeek-V4.1-Flash-1017"],
  "release_date": "2026-10-17",
  "knowledge_cutoff": "2025-05",
  "open_weights": false,
  "context_window": 1000000,
  "max_output": 384000,
  "capabilities": {
    "reasoning": true,
    "tool_call": true,
    "structured_output": true,
    "vision": true,
    "cache": true
  },
  "price": {
    "cny": { "input": 0.15, "output": 0.6, "cache_read": 0.003, "unit": "per_1m_tokens" },
    "usd": null,
    "source_url": "https://api-docs.deepseek.com/quick_start/pricing",
    "verified_at": "2026-11-25"
  },
  "scores": [
    { "benchmark": "opencompass_code", "score": 82.4, "rank": 7,
      "source": "OpenCompass", "source_url": "...", "as_of": "2026-11-01" }
  ],
  "curation": {
    "fit_for": ["高并发客服", "轻量 Agent"],
    "avoid_for": ["超长文档精读"],
    "note": "缓存价极低，重复 system prompt 场景优势明显"
  }
}
```

**币种规则（必须写进代码约束）：**
- **实测结论（2026-11-25）：models.dev 与 OpenRouter 的价格都是美元**，不是人民币。人民币官方价只能来自 `data/prices-cny.json`（人工对照厂商定价页录入），未录入的显示"待校验"，绝不拿美元值冒充。
- `cny` 与 `usd` 分开存，**永不自动换算**。国内模型同时展示两列，国际模型只展示美元。
- 单位统一为「每百万 token」，入库时就归一化，杜绝 per 1K / per token 混用。
- 价格 0 一律视为「未知」，不显示为"免费"（models.dev 里有大量 0 是没填）。
- 每个价格必须带 `source_url` + `verified_at`，UI 上悬停可见。

**L2 评测分的人工录入格式（`data/scores-manual.json`，2026-11-25 落地）：**

一个榜单一块，来源/日期写在块级，不逐行重复：

```json
{
  "version": 1,
  "benchmarks": {
    "swe_bench_verified": {
      "label": "SWE-bench Verified",
      "unit": "percent",              // percent | score | ms | tokens_per_s
      "higherIsBetter": true,
      "source": "厂商技术报告",
      "sourceUrl": "https://...",
      "asOf": "2026-11-20",
      "scores": { "qwen4-max": 72.4, "glm-5.3": 68.9 }
    }
  }
}
```

同步时逐条校验：未知模型 id 忽略并告警、percent 超出 0–100 忽略并告警、同一块没人匹配上也要告警。跑完 `data/meta.json` 里会多出 `benchmarks[{id,label,source,asOf,count}]`，前端表尾直接展示「本榜指标 / 来源 / 截至日期」。

**子榜指标 id 约定**（有数据自动切换，无数据退回兜底排序）：

| 子榜 | 优先指标（按顺序取第一个有数据的） | 兜底 |
|---|---|---|
| 综合能力 | `opencompass_overall` → `aa_intelligence` → `superclue_overall` | 无 |
| 代码与工具调用 | `swe_bench_verified` → `opencompass_code` → `livecodebench` → `opencompass_agentic`（列名「智能体分」+ 黄条） | 综合分（标 ※） |
| 中文写作与长文 | `superclue_zh_writing` → `opencompass_writing` | 综合分（标 ※） |
| 知识问答 / RAG | `opencompass_knowledge` → `simpleqa` → `knowledge_qa` | 声明上下文 |
| 高速低价 | `ttft_ms` → `output_tokens_per_s` | 输入单价 |

有专属指标的子榜只保留有分的型号；**综合榜例外**（`keepUnscored: true`），它是入口页，要让人看到全部型号。**性价比与所有「综合分※」兜底必须使用 `overallBenchmarkId()` 返回的同一个指标**，不允许同一页里 A 模型按司南分、B 模型按 AA 分比高低。

**已接入的真实分数（2026-11-25，来源均人工核对榜单页）：**

| 块 | 来源 | 覆盖 | 说明 |
|---|---|---|---|
| `opencompass_overall` | 司南 V3.0，2026-11-20 更新 | 13/42 | 综合榜主指标 |
| `opencompass_knowledge` | 同上 | 13/42 | RAG 榜主指标 |
| `opencompass_agentic` | 同上 | 13/42 | 司南无独立代码子榜，代码榜暂用智能体分并明确标注 |
| `superclue_overall` | SuperCLUE 2026-11 总榜 | 11/42 | 综合榜第三备选；本期无写作单项，**不得拿来顶替写作榜** |
| `ttft_ms` | Artificial Analysis 模型页 | 5/42 | 取 Time to First Tokens，非首个答案 token |
| `output_tokens_per_s` | 同上 | 5/42 | 高速低价榜第二备选 |

仍缺：SWE-bench Verified 官方榜没有任何一行能无歧义对上我们的型号（都是同厂不同代或不同快照）；中文写作单项；其余 29 个型号在司南榜未收录；3 个国际参照不在司南榜内。

### 4.4 模型归一化（最容易出错，单独设计）

同一个模型在不同源里有 4 种名字：`DeepSeek-V4.1-Flash`、`deepseek/deepseek-v4.1-flash`、`deepseek-v4-flash`、`DeepSeek V4.1 Flash 1017`。

方案：
1. `data/aliases.json` 维护「源内 ID → canonical id」映射表，人工维护，受版本控制。
2. 归一化脚本按优先级匹配：精确 alias → 规范化后（小写/去分隔符）匹配 → 模糊匹配，**模糊匹配结果只进入待确认队列，不自动入库**。
3. 每个模型详情页展示「本页数据来自哪些源」，映射错了能一眼看见。
4. 归一化函数写单元测试，用真实源 ID 做 fixture。

没有这一步，榜单会出现重复行、价格张冠李戴——这是这类产品最常见的翻车点。

### 4.5 更新流水线

```
.github/workflows/sync.yml   (cron: 每周一 03:00 CST，硬数据可选每日)
        │
        ▼
scripts/sync/index.ts
  ├─ fetchModelsDev()      免 key
  ├─ fetchOpenRouter()     免 key
  ├─ fetchLiteLLM()        免 key
  ├─ scrapeOpenCompass()   容错解析，失败不阻断
  ├─ scrapeSuperCLUE()     同上
  ├─ normalize()           归一化 + 币种校验
  ├─ validate()            zod schema 校验 + 异常检测
  └─ write()               data/*.json + data/meta.json
        │
        ▼
  有 diff → 自动提交 → Vercel 自动部署
  校验失败 → 不提交，开 GitHub Issue 告警，线上保留旧快照
```

**校验规则（宁可报错，不可静默出错）：**
- 必填字段缺失 → 失败
- 价格变动 > 50% 或分数变动 > 20% → 不自动合并，标记 `needs_review`
- 模型数骤降 > 20% → 判定为源异常，失败
- 每次运行写 `data/meta.json`：`{ updated_at, sources: [{name, ok, fetched_at, count}], warnings: [] }`，首页展示

**爬虫纪律：** 只抓公开页面、遵守 robots.txt、单域名请求 ≥ 3s 间隔、带说明性 UA、最多 3 次指数退避重试。对外公开时加免责声明与来源链接。

---

## 5. 功能规格

### 5.1 榜单页 `/leaderboard`

- 顶部：子榜 tab（6 个）；右侧「数据更新于 2026-11-24 · 3/5 源正常」状态灯
- 左栏筛选：厂商、开源/闭源、上下文区间、价格区间、能力（工具调用/推理/视觉）
- 主表：`名次 / 模型 / 厂商 / 上下文 / 输入价 / 输出价 / 缓存价 / 子榜分 / 发布日`，列可排序、可隐藏
- 行内：价格来源 icon（悬停显示官方链接 + 校验日期）、子榜分来源标签
- 勾选 2–4 行 → 底部浮出「对比」条
- 缺数据显示 `—` 并在 tooltip 说明原因，**不参与排序时的隐性补零**
- 价格缺失的型号**不进首版清单**；若上游源异常导致某行突然缺价，该行照常显示但价格列标「待校验」+ 悬停写原因、按价格排序时置底，并且不参与性价比榜
- 移动端：表格转卡片

实现要点：数据在构建时静态生成（服务端读 JSON），筛选/排序/对比在客户端完成。表格是手写的，没有引 TanStack Table——45 行、9 列的规模用不上虚拟化，引入反而多一个依赖和一层抽象；等行数上百再换。

### 5.2 成本试算器 `/calculator`（重点）

**输入**

| 参数 | 默认 | 说明 |
|---|---|---|
| 日请求量 | 1000 | |
| 平均输入 token | 800 | 含 system prompt |
| 平均输出 token | 300 | |
| 缓存命中率 | 0% | 命中部分按 cache_read 价 |
| 失败重试率 | 3% | 成本 ×(1+重试率) |
| 推理模型输出膨胀 | 1.0× | 推理模型常输出更多 token，给滑块 |
| 所选模型 | 最多 4 个 | 从榜单带入 |

**公式（写进 `lib/cost.ts` 并做单测）**

```
单次输入成本 = inTok × P_in × (1 - hit)      + inTok × hit × P_cache
单次输出成本 = outTok × P_out × inflate
单次成本     = (单次输入成本 + 单次输出成本) × (1 + retry)
月成本       = 单次成本 × 日请求量 × 30
```

**输出**
- 4 个模型的单次 / 日 / 月成本横向条形图 + 排序
- 两两差额：「换成 B 每月省 ¥3,240 / 涨 2.1 倍」
- 每千次会话成本（便于对外报价）
- 每个数字下方注明「按 A 厂商官方价 ¥x/M tokens，2026-11-25 校验」

**必须处理的边界**
- 模型无人民币价（国际模型）→ 单独分区，不混入人民币排序
- 价格缺失 → 显示"无公开报价"，不预估
- 缓存不支持但用户设了命中率 → 提示并归零
- 页面底部固定一行免责：估算不含存储/向量库/网络/人力

**验收：** 用某模型做 100 次真实调用（记录实际 input/output token 与账单），与计算器结果比对，误差 < 5%。

**落地状态（2026-11-25）：** `lib/cost.ts` 公式 + 单测 10 条；`components/cost/CostCalculator.tsx` 为客户端组件，币种切换、4 个场景预设（客服 / 摘要 / RAG / Coding Agent，只改 token 结构与命中率）、缓存命中 / 重试 / 输出膨胀三个滑块、按厂商分组的型号选择器（最多 4 个，无当前币种报价的选项禁用）、月成本条形排序、单次 / 每日 / 每千次成本、价差结论、无报价分区。榜单勾选后点「带入成本试算」通过 `?models=` 预选。`formatMoney` 按量级换精度，避免单次成本显示成 ¥0.00。**尚未做：** 真实调用对账（需要 API key 与账单），留到 DeepSeek key 接入后一起做。

### 5.3 对话式选型顾问 `/chat`（M4，不在首版 MVP）

**架构：工具调用，不是把数据塞 prompt。**

```
用户提问
  → DeepSeek (OpenAI 兼容, function calling)
      tools: search_models(filters)
             estimate_cost(model_ids, volume)
             compare_models(ids)
  → 工具从本地 JSON 查数（与页面同一份数据）
  → 流式返回回答 + 引用 chips（可点进详情）
```

**防幻觉硬规则**
- 系统提示明确：价格、上下文、分数**只能来自工具返回**，禁止自行推断或使用训练记忆
- 站内未收录的模型 → 必须回答"未收录，无法给出站内依据"，并说明可做什么
- 每条涉及数字的结论必须附来源 chip；没有来源就不许写数字
- 输出上限 800 tokens；记录每次 token 用量；设日预算上限（如 ¥5/天）防止刷爆
- 温度 0.2–0.4

**为什么不做 RAG 向量库：** 45 行数据、几十个字段，结构化查询比向量检索准得多，也更便宜。向量库在这里是过度设计。

**落地状态（2026-11-26）：** `/chat` + `/api/chat` 已完成，改为用户自带 Key 优先（密钥只存浏览器），DeepSeek 环境变量仅兜底。工具调用、防幻觉提示、引用 chips、限流与日预算已就位；暂为非流式。细节与安全取舍见 §7.4。

### 5.4 方法论页 `/method`（差异化，成本低价值高）

必须讲清的 4 件事：
1. 为什么不同榜单的分数不能加总（口径、题目版本、采样策略不同）
2. 为什么选型要看「单位任务成本」而不是「每百万 token 价格」
3. 为什么缓存价、批处理价会改变结论（长 system prompt 场景可省 80%）
4. 这个站的局限：不测你的数据、不含私有化部署、价格可能滞后

---

## 6. 技术栈与工程结构

**栈**：Next.js 16 (App Router) + React 19 + TypeScript strict + Tailwind v4 + zod + Vitest；账号用 Supabase Auth + Postgres（`@supabase/supabase-js`）
**存储**：榜单数据仍是 JSON 存仓库，Git 即审计日志（每次价格变化都有 diff 可查）；账号数据（收藏 / 对比清单 / 对话历史）存 Supabase Postgres，四张表全部启用 RLS（见 `supabase/schema.sql`）
**部署**：Vercel。对话默认用户自带 Key（仅存浏览器、随请求转发）；`DEEPSEEK_API_KEY` 可选作为兜底，服务端路由代理，**不暴露到前端**。Supabase 未配置时账号功能优雅降级，其余功能不受影响。
**测试**：Vitest 覆盖 `normalize.ts` / `cost.ts`（纯函数，最该测）

```
app/
  page.tsx
  leaderboard/page.tsx
  models/[slug]/page.tsx
  compare/page.tsx
  calculator/page.tsx
  chat/page.tsx            # M4
  method/page.tsx
  api/chat/route.ts        # M4，服务端代理 DeepSeek
components/
  leaderboard/  model/  cost/  chat/  auth/  account/  ui/
data/
  models.json  benchmarks.json  aliases.json  meta.json
  snapshots/               # 上次成功抓取的原始快照，用于降级
supabase/
  schema.sql               # 四张表 + 索引 + RLS 策略
scripts/
  sync/{models-dev,openrouter,litellm,opencompass,superclue,normalize,validate,index}.ts
lib/
  cost.ts  query.ts  types.ts  sources.ts
.github/workflows/sync.yml
```

**关于"基于高星项目改造"的结论（已确认）：** 高星项目（LobeChat、OpenWebUI 等）都是聊天应用，没有榜单与成本计算器，fork 之后要拆掉 80% 的代码再重建，工作量大于重写。实际复用的是**数据层**（models.dev、LiteLLM 的数据与规范化思路）和**组件**（shadcn、TanStack Table、AI SDK）。这是"站在开源肩膀上"的正确姿势，不是 fork 一个大仓库。

---

## 7. 里程碑

| 阶段 | 内容 | 产出 / 验收 | 预估 |
|---|---|---|---|
| **M0 数据管线** | 三个免 key 源接入 + 归一化 + zod 校验 + 45 行模型 JSON | `npm run sync` 跑通；42 个国内模型全部有人民币价；单测通过 | 3 天 |
| **M1 榜单** | 六个子榜 + 筛选排序 + 勾选对比 + 更新状态灯（骨架已完成，见 7.2） | 10 秒内看懂"哪个模型在哪方面强、多少钱" | 4 天 |
| **M2 成本计算器** | 公式 + 真实调用对账 + 4 模型对比图 | 与真实账单误差 < 5% | 2 天 |
| **M3 上线** | 部署 Vercel + `/method` + 首页 + Actions 定时 + 第 10 节合规 6 项 | 线上可访问；robots/免责/来源标注就位；Actions 手动触发一次成功且有 diff | 2 天 |
| M4 对话顾问 | 工具调用 + 引用 + 预算护栏 | 3 个典型问题回答准确率主观 ≥ 8/10，无编造价格 | 3 天（基础版已完成，见 §7.4；待真实 Key 实跑与流式） |
| M5 完善 | 模型详情页、对比页细化、结论复制/导出 | — | 2 天 |

**MVP 范围冻结在 M0–M3（约 11 天，可压缩到 1 周）**，先能演示、能真用，再上对话。

### 7.1 M0 实际完成情况（2026-11-25）

| 项 | 结果 |
|---|---|
| 项目骨架 | Next.js 16 + TS strict + Tailwind v4，`next build` 通过 |
| 数据接入 | models.dev ✅、OpenRouter ✅（472 条含 AA 指数）、LiteLLM ✅（走 jsdelivr） |
| 入库 | **45 个模型**（国内 42 + 国际参照 3），写入 `data/models.json` + `data/meta.json` |
| 人民币价 | **42/42 国内模型全部有价**：官方核验 34、第三方转引 8；待补 0 |
| 测试 | 11 个单测通过（归一化 5 + 成本公式 6） |
| 自动更新 | `.github/workflows/sync.yml` 已配，失败开 Issue 告警 |

M0 遗留（进 M1 前置）：
- **查不到官方定价的型号已从清单剔除**（2026-11-25 决定），不做"待校验"占位。剔除记录：

  | 模型 | 剔除原因 | 链接备查 |
  |---|---|---|
  | Qwen3.8 Omni Flash | 模型页无价格段，总价目表也无该型号行 | https://help.aliyun.com/zh/model-studio/model-pricing |
  | DeepSeek V3.2 | 百炼侧页面 404，DeepSeek 官方价目页只列 V4.1 Flash / V4 Pro | https://api-docs.deepseek.com/zh-cn/quick_start/pricing |
  | DeepSeek V4 Flash Vision | 官方只给 V4 Flash 基座价，未单列 Vision 变体 | https://api-docs.deepseek.com/zh-cn/quick_start/pricing |
  | MiniMax M2.7 | 官方定价页已移除 M2.7 | https://platform.minimax.cn/docs/guides/pricing |

  若之后官方补上定价，在 `data/aliases.json` + `data/prices-cny.json` 各加一行即可重新纳入。
- `baidu/ernie-5.5-flash-preview` 在 OpenRouter 只以 `:free` 变体存在，不能当美元参考价；同步脚本已跳过零价渠道，文心 5.5 目前**只有人民币价、无美元价**。
- `reported` 档位的含义：价格来自媒体转引或渠道页，不等于核对过厂商定价页；UI 必须与 `verified` 视觉区分。
- OpenCompass / SuperCLUE 自动抓取未做；榜单分数目前靠人工核对后写入 `data/scores-manual.json`（2026-11-25 已录入 6 块，见 §4.3）。
- 阶梯价目前只取低档，UI 必须显示 note（如豆包 32K 以上价格翻倍），否则会低估成本。

### 7.2 M1 榜单骨架完成情况（2026-11-25）

已上线：`/leaderboard` 六个子榜 tab、厂商/开源/上下文/输入价/能力开关筛选、搜索、列排序、人民币/美元切换、勾选 2–4 个对比（弹层）、数据状态灯；`/method` 方法论页；首页入口与页脚免责。路径：[app/leaderboard/page.tsx](app/leaderboard/page.tsx)、[components/leaderboard/Leaderboard.tsx](components/leaderboard/Leaderboard.tsx)、[lib/leaderboard.ts](lib/leaderboard.ts)。

实现中定下的三条规则：
1. **国际模型默认不进榜**，用「含国际参照」开关显式打开；它们只有美元价，切人民币时价格列显示「—」，不按汇率倒推。
2. **综合榜改用司南 V3.0 综合分（13 个国内型号）**，覆盖比 AA 的 10 个更全，且包含当前旗舰 qwen3.8-max、doubao-seed-2.1-pro、deepseek-v4.1-flash；AA 指数降为次选。代价是 3 个国际参照在综合榜没有分数（它们不在司南榜内），开「含国际参照」后综合分列为「—」，主要在成本列起作用。
   其余子榜缺分时一律用「综合分※」并挂黄条说明真正依据，不做假排序：中文榜按综合分、RAG 兜底按声明上下文、高速低价兜底按输入单价。
3. **性价比榜只收有指标的型号**（分 ÷ 输入价），免费型号与缺分型号不进榜，避免整屏「—」。

未完成（进 M1.5）：移动端卡片视图（当前窄屏横向滚动）、`/models/[slug]` 详情页、独立 `/compare` 页、代码/中文/延迟三类真实子分。

L2 已接入真实数据（2026-11-25）：`data/scores-manual.json` 写入 6 块、共 70 条分数，同步后综合榜切到司南综合、代码榜切到司南智能体（列名与黄条均标注「不是纯代码」）、RAG 榜切到司南知识、高速低价榜切到 AA 首 token（5 行，按 ms 升序）。中文写作仍走「综合分※」——SuperCLUE 2026-11 总榜没有写作维度，不用总分顶替；SWE-bench 官方榜无可对上的型号，0 条录入。`asOf` 支持 null（AA 无统一截止日期），UI 显示「未标注」。

### 7.3 视觉换肤与日夜模式（2026-11-25）

风格参照 AIHOT（用户指定），改为**左侧栏应用外壳**，强调色锁定**雾蓝**。实现方式：

- 主题 token 写在 [app/globals.css](app/globals.css)：`@theme inline` 把 CSS 变量映射成语义类（`bg-bg`、`text-ink`、`border-line`、`text-accent-ink`、`bg-accent-soft`、`shadow-card`/`shadow-float` 等），深色只在 `html[data-theme="dark"]` 覆盖变量，组件里不出现 `dark:` 前缀。
- 三态主题（自动/浅色/深色）持久化在 `localStorage["mp-theme"]`，[app/layout.tsx](app/layout.tsx) 在 `<head>` 内联首屏脚本先定主题避免闪白；[components/ThemeToggle.tsx](components/ThemeToggle.tsx) 负责切换与跟随系统。
- 已知坑：变量驱动的颜色遇到 CSS `transition` 时，切换主题会卡在旧值（无头浏览器尤其明显）。处理办法是切换瞬间给 `<html>` 加 `theme-switch` 类全局禁用过渡，双 rAF + 250ms 兜底后移除。
- 外壳：[components/SiteSidebar.tsx](components/SiteSidebar.tsx)，桌面 232px 固定侧栏，`<768px` 收成顶部图标栏；首页、榜单、成本试算、方法论四页全部换肤，业务逻辑与数据口径零改动。

### 7.4 对话顾问与 BYOK 密钥入口（2026-11-26）

按 §5.3 落地 `/chat`，但密钥模型从「站点密钥」改为**用户自带 Key（BYOK）优先**：

- **密钥只存在浏览器** `localStorage["mp-llm-settings"]`（Key / 模型名 / 可选 Base URL），随请求头 `x-llm-key` 发给 `/api/chat`；路由只做转发，不落库、不写日志，响应不缓存。设置弹窗明确提示共用电脑用后清除。
- 站点环境变量 `DEEPSEEK_API_KEY` 仅作可选兜底；使用站点 Key 时启用**单实例内存限流**（30 次 / 5 分钟 / IP）与**每日 token 预算**（`LLM_DAILY_TOKEN_BUDGET`，默认 30 万）。公开部署仍需平台级 WAF/限流。
- 工具调用：[lib/assistant.ts](lib/assistant.ts) 定义 `search_models` / `estimate_cost` / `compare_models`，直接读 `data/models.json` 与 `lib/cost.ts` 公式。单次回答最多 3 轮工具、最多 800 输出 token、温度 0.2；工具结果按 JSON 整体传递，超长时返回错误而不是截断坏 JSON。
- 防幻觉：系统提示禁止凭训练记忆补价格/分数、禁止汇率换算、缺价不得当 0；回答下方引用 chips 来自本轮工具实际触碰的型号，可跳到 `/leaderboard?q=` 定位（榜单已支持该参数）。
- 自定义端点仅接受 https 公网域名，拒绝 localhost/内网 IP/带账号密码 URL，降低 SSRF 风险。
- **验证**：工具层 12 条 + 路由链路 4 条单测（mock 上游跑通「工具调用 → 查本地数据 → 最终回答 → 引用」），全量 63 条通过；`tsc`、`next build` 通过；浏览器验证设置保存/掩码、缺 Key 与 401 错误、引用回跳、深色模式。**未验证**：没有真实 Key，真实模型的回答质量与工具往返尚未实跑；当前为非流式一次性返回。

### 7.5 首次访问封面（2026-11-26）

用户参考 01Claw 官网落地页，确认做「封面 + 进入按钮」而非真实账号体系：

- [components/IntroCover.tsx](components/IntroCover.tsx) 是全屏浮层，含品牌、主标题、价值主张、流程卡、进入 CTA 和数据口径入口；右上角是账号状态位（未登录显示「登录 / 注册」，已登录显示昵称并跳 `/account`），页脚文案说明匿名可浏览、登录只用于保存数据、API Key 只存浏览器。
- 首次访问显示：`localStorage["mp-entered"]` 未标记时出现；进入、按 Esc 或跳转方法论都会写入标记并淡出，之后直接进站。
- 重看入口：侧栏底部与页脚各一个「重看封面」，通过 `mp:show-intro` 事件唤出，不改路由。
- 浮层打开时锁定 body 滚动，焦点落在「进入工作台」；`prefers-reduced-motion` 下关闭入场动画。
- 封面不阻断 `/login`：直接访问登录页时自动跳过封面，避免登录流程被打断。
- **账号决策已修订**：本节最初只做封面、不做登录；2026-11-26 用户要求真实注册登录，已按 §7.6 落地 Supabase 可选账号，封面同步改为真实账号入口，不再出现「无需注册」文案。
- **验证**：浏览器验证首次出现、进入后不再出现、重看可再次出现、次要按钮跳 `/method`、深浅色无横向溢出、无 console 错误；`tsc` 通过。

### 7.6 可选账号体系（2026-11-26）

用户确认「我要做真实注册登录」，技术栈选 Supabase，账户数据限定三块：收藏型号、保存对比清单、对话历史。核心原则是**账号可选**：浏览、筛选、试算、匿名问答全部不需要登录。

- **认证**：[lib/supabase.ts](lib/supabase.ts) 懒创建客户端；未配置 `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` 时 `isSupabaseConfigured=false`，登录页显示配置指引而非报错。[components/auth/AuthProvider.tsx](components/auth/AuthProvider.tsx) 提供 `configured / loading / user / signIn / signUp / signOut`，挂载时 `getSession` + `onAuthStateChange`。注册带 `display_name`，邮箱确认回调回 `/login?confirmed=1`。
- **数据层**：[supabase/schema.sql](supabase/schema.sql) 建 `favorites`、`saved_comparisons`、`chat_threads`、`chat_messages` 四张表；全部启用 RLS（`auth.uid() = user_id`），`chat_messages` 插入额外要求线程属于本人；`revoke all from anon`，只授权 `authenticated`。客户端访问统一走 [lib/account.ts](lib/account.ts)，显式传 `userId`，不信任前端判断，安全最终由 RLS 兜底。
- **未登录拦截**：[components/auth/LoginGate.tsx](components/auth/LoginGate.tsx) 弹层说明「收藏 / 对比 / 对话历史」的价值，跳转带 `next` 参数；`safeNext` 只接受站内单斜杠路径，拒绝 `//`、`/\`、绝对 URL 与 `/login` 自身，防开放重定向。对比弹层保存时保留 `?compare=` 选择。
- **功能接入**：榜单行内星标（乐观更新，失败回滚并提示）；对比弹层「保存清单」（2–4 个型号）；`/chat` 登录后建线程并追加消息，持久化与 LLM 请求并行，Supabase 慢或失败不阻塞回答，错误单独显示为同步提示；`/account` 汇总收藏、清单、对话，支持逐条删除（退出登录不自动删除）。
- **工作台外壳**：侧栏账户面板、移动端顶栏账户图标、页脚账号行、封面账号位统一读 `useAuth`；未配置时点击收藏会打开「账号服务还没连接」弹层并指向配置步骤。
- **安全边界**：模型 API Key 与账号完全解耦，仍只存浏览器 `localStorage`，不随账号上传；Supabase 只用 anon / publishable key，`service_role` 绝不下发到客户端。
- **验证**：`npm test` 72 条通过（新增 9 条 `safeNext` / 错误文案 / 引用解析）、`tsc` 通过、`next build` 通过；浏览器验证封面账号位、登录页/账户页未配置状态、榜单星标触发未配置弹层、窄屏无横向溢出。**未验证**：真实 Supabase 项目下的注册、邮箱确认、登录、RLS 跨账号隔离与数据持久化——需要用户提供项目 URL 与 anon key 后在 `.env.local` 配置再实跑。

---

## 8. 风险台账

| 风险 | 影响 | 概率 | 对策 |
|---|---|---|---|
| 币种/单位搞错 | 高（结论全错） | 高（已踩中） | 实测确认 models.dev 为美元折价，代码强制 cny/usd 分列、不换算；人民币只收人工校验值 |
| 归一化错配（一个模型两行） | 高 | 高 | aliases 受控维护；模糊匹配只进待确认队列；详情页展示来源映射 |
| 跨榜分数合并误导 | 高（专业性质疑） | 中 | 明确不合并；方法论页讲清；每个分数带来源日期 |
| 爬虫失效/结构改版 | 中 | 高 | API 优先；解析容错；失败保留快照；Issue 告警 |
| LLM 编造价格 | 高 | 中 | 工具调用取数；无来源不输出数字；温度 0.2 |
| 国内访问 Vercel 慢 | 中 | 中 | 首屏静态化；备选国内托管（EdgeOne/阿里云） |
| 数据版权/robots（已确认公开） | 中 | 中 | 不全量镜像，只存归一化字段 + 来源链接；上线前完成第 10 节 6 项合规动作 |
| 公开后被刷 Key | 中（花钱） | 中 | 对话限流 + 日预算上限 + 单次 max_tokens 上限 |
| 范围膨胀 | 高（做不完） | 高 | MVP 冻结 M0–M3，新想法进 v2 清单 |

---

## 9. 度量

- 首次完整选型耗时（自己计时，目标 < 10 分钟）
- 数据新鲜度：硬数据 ≤ 1 天，评测分 ≤ 7 天，首页可见
- 计算器误差 < 5%
- 自动更新成功率 ≥ 90%（失败有告警）
- 作品集侧：能在 5 分钟内讲清"我为什么这么设计数据层和成本公式"

---

## 10. 已确认决策（2026-11-25）

| 项 | 决定 |
|---|---|
| DeepSeek API Key | **M4 前提供**，不阻塞 M0–M3；放 Vercel 环境变量，服务端使用 |
| 是否公开访问 | **公开**。按"可公开但低调"执行，上线前完成下列合规项 |
| 域名 | 暂用 `*.vercel.app` 默认域名，后续再绑自定义域名（可随时补） |
| 模型清单 | **按附录 A 收录**，Qwen3.8 的 Max / Plus / Flash / 27B 全系收 |
| 无官方定价的型号 | **不进首版**（2026-11-25 剔除 Qwen3.8 Omni Flash、DeepSeek V3.2、DeepSeek V4 Flash Vision、MiniMax M2.7），补上定价后再加回 |
| 账号体系 | **可选账号**（2026-11-26）：Supabase Auth + Postgres，只存收藏 / 对比清单 / 对话历史；匿名浏览不受影响，未配置时优雅降级 |

### 公开访问带来的必做项（并入 M3 验收）

1. 每个数据点展示来源 + 抓取时间；`/method` 写清口径与局限
2. `robots.txt`：允许收录页面，禁止抓取 `/api/*`
3. 页脚免责声明：数据可能滞后，不构成采购建议；榜单数据版权归原机构
4. 爬虫只请求公开页面，遵守目标站 robots，UA 标明站点与联系邮箱
5. 账号可选：浏览与试算不需要登录；登录后收藏 / 对比清单 / 对话历史存 Supabase Postgres（RLS 隔离），匿名对话不落库，仅记 token 用量
6. 对话接口加限流（同 IP 每小时 N 次）+ 日预算上限，防止被公开滥用刷爆 Key

---

## 11. 上线路线图（2026-11-26）

目标：真实上线，给自己和初级 AIPM 同行长期使用，作品集可展示。全程免费（Vercel + Supabase 免费档），域名可选。她只需要拍板 2 个决定：GitHub 仓库公开/私有、国内访问路线。

| 阶段 | 内容 | 产出 / 验收 | 她的决策 |
|---|---|---|---|
| 0 账号收尾（进行中） | Supabase 已配置、建表与 RLS 已验证（匿名访问被拒）；剩下全链路实跑：注册 / 收藏 / 对比 / 对话 / 跨账号隔离 | 收藏刷新后仍在；账号 B 看不到账号 A 数据 | 关 Confirm email（本地演示）或点邮件确认 |
| 1 上线准备 | 建 GitHub 仓库（当前还不是 git 仓库）；手动触发一次 sync 验证 Actions；确认 robots.txt 与页脚免责在位 | Actions 绿勾且正常产生/跳过 diff，异常有告警 | **仓库公开还是私有**（作品集建议公开） |
| 2 部署 | Vercel 绑 GitHub 自动部署；配置 Supabase 两个环境变量；`DEEPSEEK_API_KEY` 可选兜底 | 线上可访问、可注册、可试算；`/method` 与免责在位 | 无（Vercel 免费档，先不买域名） |
| 3 体验完善（可并行） | 对话流式输出、移动端卡片视图、`/models/[slug]`、独立 `/compare` | 按现有测试标准 + 浏览器验证 | 顺序她定 |
| 4 域名与国内访问 | A) Vercel + 自定义域名（当天完成，~¥60–90/年，国内偏慢）；B) EdgeOne Pages + ICP 备案（1–2 周，国内快）；C) 先 A 后迁移（推荐） | 国内打开首屏 <3s 视为达标 | **A / B / C 三选一** |
| 5 真实验收 | 真实 Key 实跑对话（回答质量 + 工具往返）；100 次真实调用与试算器对账误差 <5%；连续 4 周自动同步 ≥3 次成功 | 见 §1.2 成功标准 2、3 | 提供 DeepSeek Key |

未定遗留：Supabase 未全链路实跑（阶段 0）；对话非流式、未真实 Key 实跑；`/models/[slug]` 与独立 `/compare` 未做；真实调用对账未做；L2 评测分仍靠人工录入（自动抓取 OpenCompass/SuperCLUE 未做，本机网络限制）。

---

## 附录 A：首版模型清单（已确认）

| 厂商 | 候选 | 说明 |
|---|---|---|
| 阿里 | Qwen3.8-Max / Plus / Flash / 27B | 全系覆盖，代表"能力—成本"梯度 |
| DeepSeek | V4.1 Pro / Flash | |
| 智谱 | GLM-5.3 / Flash / FlashX | |
| 月之暗面 | Kimi K3.1 Pro / K3 | 长上下文代表 |
| 字节 | 豆包（火山方舟主力型号） | 国内调用量最大，必收 |
| MiniMax | M3.1 / M3.1 Flash | |
| 阶跃 | Step-5 | |
| 腾讯 | 混元主力型号 | |
| 百度 | 文心 5.5 | |
| 国际基准 | GPT-6.x、Claude Opus 5.5、Gemini 4 | 仅作成本/能力参照，单独分区 |

> 收录标准：国内可开发票、有公开 API、有公开价格。只有开源权重无 API 的，v1 不收。

---

## 附录 B：已验证的接口（可直接用于 M0）

```bash
# 主数据层，免 key，6.9MB
curl https://models.dev/api.json

# 交叉校验，免 key，470 模型
curl https://openrouter.ai/api/v1/models

# 价格旁证，含官方文档 URL
curl -L https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json

# 评测分（HTML，需解析 + 容错）
# https://rank.opencompass.org.cn
# https://www.superclueai.com
# LMArena：本机不可达，改用第三方镜像或人工快照
```