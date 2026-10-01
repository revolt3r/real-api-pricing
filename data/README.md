# Data / 数据

Current snapshot: <!-- stat:snapshot -->2026-10-01<!-- /stat -->. The adopted dataset contains <!-- stat:points_total -->318<!-- /stat --> plan × model rows: <!-- stat:points_subscription -->299<!-- /stat --> subscription rows (<!-- stat:points_allowance -->298<!-- /stat --> with a monthly allowance plus one unmetered promotional row, Devin Pro × SWE-2 at ≈$0/MTok until 2026-10-31) and <!-- stat:points_metered -->19<!-- /stat --> metered API rows. This covers the project's adopted sample, not every plan or model on the market.

These files are the public redacted edition. Original local evidence is backed up outside Git; see [PUBLICATION.md](../PUBLICATION.md). 本目录为公开脱敏版，保留数值、来源与取舍记录，原件仅存于 Git 忽略的本地备份。

当前采用数据共<!-- stat:points_total -->318<!-- /stat -->条“套餐 × 模型”：<!-- stat:points_subscription -->299<!-- /stat -->条订阅（<!-- stat:points_allowance -->298<!-- /stat -->条有月额度，另1条不计额度促销点 Devin Pro × SWE-2，≈$0/MTok，促销至2026-10-31）、<!-- stat:points_metered -->19<!-- /stat -->条按量API，包括OpenCode Go <!-- stat:plans_opencode_go -->28<!-- /stat -->个模型、Command Code GOAT <!-- stat:plans_command_code_goat -->58<!-- /stat -->个模型、Ollama <!-- stat:plans_ollama -->22<!-- /stat -->个点、Step Plan 国内站<!-- stat:plans_step_plan -->12<!-- /stat -->个点、MiMo Token Plan <!-- stat:plans_mimo_token -->32<!-- /stat -->个点。所有采用数据都参与对应的全量输出；缺榜单分数的模型不进入该榜帕累托图，但仍保留在额度和单价数据中。

美元/credits 额度与三段价换算统一按 `conventions.json` 的标准负载（缓存读取 97%、普通输入 2.5%、输出 0.5%）折算；直接给出 total tokens 的面板、日志与跑满实测不重复归一。Anthropic 档与低缓存档等其余负载口径见 [CONVENTIONS.md](../CONVENTIONS.md) 第 2 节；逐样本负载审计见 [`token-mix-audit-round2-2026-09-07.json`](research/token-mix-audit-round2-2026-09-07.json)。

| Board / 榜单 | Scored rows / 有分行 | Unscored rows / 缺分行 |
|---|---:|---:|
| AA Intelligence | <!-- stat:scored_aa_intelligence_index -->268<!-- /stat --> / <!-- stat:points_total -->318<!-- /stat --> | <!-- stat:unscored_aa_intelligence_index -->50<!-- /stat --> |
| AA Coding Agent | <!-- stat:scored_aa_coding_agent_index -->97<!-- /stat --> / <!-- stat:points_total -->318<!-- /stat --> | <!-- stat:unscored_aa_coding_agent_index -->221<!-- /stat --> |
| Code Arena | <!-- stat:scored_arena_code -->178<!-- /stat --> / <!-- stat:points_total -->318<!-- /stat --> | <!-- stat:unscored_arena_code -->140<!-- /stat --> |
| Agent Arena | <!-- stat:scored_arena_agent_mode -->164<!-- /stat --> / <!-- stat:points_total -->318<!-- /stat --> | <!-- stat:unscored_arena_agent_mode -->154<!-- /stat --> |
| OpenDesign Arena | <!-- stat:scored_open_design_arena -->88<!-- /stat --> / <!-- stat:points_total -->318<!-- /stat --> | <!-- stat:unscored_open_design_arena -->230<!-- /stat --> |
| Terminal-Bench 4.0 | <!-- stat:scored_terminal_bench_4 -->111<!-- /stat --> / <!-- stat:points_total -->318<!-- /stat --> | <!-- stat:unscored_terminal_bench_4 -->207<!-- /stat --> |
| Terminal-Bench 4.0 (AA) | <!-- stat:scored_aa_terminal_bench_4 -->36<!-- /stat --> / <!-- stat:points_total -->318<!-- /stat --> | <!-- stat:unscored_aa_terminal_bench_4 -->282<!-- /stat --> |
| DeepSWE v1.1 | <!-- stat:scored_deepswe_1_1 -->195<!-- /stat --> / <!-- stat:points_total -->318<!-- /stat --> | <!-- stat:unscored_deepswe_1_1 -->123<!-- /stat --> |

具体缺分模型以 [`points.csv`](../derived/points.csv) / [`points.json`](../derived/points.json) 的空分数字段为准；不为缺失模型补造分数。

## API 标价成本列 / API cost column

`api_cost_usd_month` = 该行采用月额度 × `list_blended_usd_per_mtok`（官方按量三段标价按同一标准负载加权）；`api_cost_multiple` = 该金额 ÷ 月费 = `d` 的倒数。标价档案按"从旧到新"排列，后档按模型覆盖前档：[`list-prices-2026-09.json`](research/list-prices-2026-09.json) → [`list-prices-round2-2026-09-09.json`](research/list-prices-round2-2026-09-09.json)。

`api_cost_usd_month` is each row's adopted monthly allowance priced at the provider's official metered rates; `api_cost_multiple` is that amount divided by the monthly fee. Both are computed from the published blended rate, so the columns reconcile exactly.

| Field | Values |
|---|---|
| `api_price_tier` | `official` (166 rows) · `official_indirect` (5) · `third_party` (8) · `unavailable` (9) |
| `api_price_confidence` | `high` / `medium` / `low`, tracking the tier |
| `api_cost_inherited` | `True` on 15 rows whose allowance was itself derived from a sibling model by a list-price ratio |
| `api_price_source`, `api_price_archive` | the rate card URL and the dated archive the rate came from |

三条限制，公开时必须一并说明：不单列缓存写入费，故所有成本是下限；`api_cost_inherited=True` 的行只是重复基准行的数字，不能当成该模型的独立证据；倍数比较的是标价与"打满订阅"，不是任何用户的实际用量。缺公开标价的模型该列留空，不补造——当前为 `deepseek-v4-flash-fast`、`glm-5.2-fast`、`kimi-k2.7-code-highspeed`、`muse-spark-1.3`、`muse-spark-1.3-contributor`、`inkling`、`inkling-small`、`omen-alpha`。

### Plan-level value / 套餐级性价比

[`plan-value.json`](../derived/plan-value.json) / [`plan-value.csv`](../derived/plan-value.csv) collapse the rows to one record per subscription: `headline_multiple` is the value shared by the largest set of the plan's priced models, and `exceptions` holds every remaining distinct value with its own models. `varies` is true when the headline covers fewer than half the plan's models, which is the case for 2 of 51 plans (OpenCode Go, Command Code GOAT) — read those as a range, not a headline. The CSV is one line per plan × value group so nothing is truncated.

套餐没有"总量"：同套餐各模型额度是互斥选项。`headline_multiple` 是覆盖模型数最多的那个倍数，`exceptions` 是其余每个不同数值及其模型。`varies=true` 表示主数字覆盖不到一半模型（51 个套餐里有 2 个），必须按区间读。CSV 一行一个"套餐 × 价值组"，不做截断。

Three limits travel with the column: cache writes are not modeled, so every figure is a floor; rows flagged `api_cost_inherited` repeat their base row rather than adding evidence; and the multiple compares list price against a saturated subscription, not against real usage. Models with no defensible published rate leave the column blank rather than receiving an invented one.

## Start here / 从这里开始

- [adopted.csv](adopted.csv): current adopted prices, allowances, confidence and rationale; generated by [build_adopted.py](../scripts/build_adopted.py). 当前采用值，不能手改。
- [points.csv](../derived/points.csv) / [points.json](../derived/points.json): computed prices plus separate leaderboard scores. 绘图使用的完整计算结果。
- [conventions.json](conventions.json): shared conventions and exchange rate. 部分说明为历史记录，以采用脚本的明确取舍为准。
- [research/](research/): dated evidence. Historical claims can contradict current decisions; they are not all adopted. 历史证据不等于当前采用结论。
- [raw/](raw/), subscription-quotas*.json, subscriptions.json and claim summaries: historical inputs retained for traceability. 历史原料保留用于溯源，不是当前主表。
- [SOURCES.md](../SOURCES.md): attribution and third-party license boundaries. 来源署名与许可边界。

Some measurements are estimates, user reports or cross-plan extrapolations. Preserve confidence and decision notes when reusing the data. 缺失分数不补造；推算值不能表述为直接实测。
