# 额度与单价总览图：订阅月额度、订阅与按量 API 真实单价
# 数据源：data/adopted.csv（生成物，勿手改）
# 用法：python scripts/plot_quotas.py
#   →  _build/{额度,单价}总览{,_英文}.png / .svg          中英文两栏横向条形图
#   →  _build/额度总览{_英文,}_混合比例.png / .svg         其余条保持对数，01/02 按对 03 的真实倍数，放不下折下
#   →  _build/{额度,单价}总览表{,_英文}.txt               中英文纯文字对齐表格
#   →  _build/前沿{额度,单价}_{CodeArena榜,AgentArena榜,AA智力榜,AA编程Agent榜}{,_英文}.*
#   →  _build/前沿筛选结果.json；publish_charts.py 再导出到 charts/
import csv
import json
import math
import os
import unicodedata

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib import font_manager

from compute import DISPLAY

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ADOPTED = os.path.join(ROOT, "data", "adopted.csv")
OUT_DIR = os.path.join(ROOT, "_build")
with open(os.path.join(ROOT, "data", "conventions.json"), encoding="utf-8") as f:
    CONVENTIONS = json.load(f)
with open(os.path.join(ROOT, "config", "allowance-fee-bands.json"), encoding="utf-8") as f:
    FEE_BANDS = json.load(f)
# API 标价成本列取自 compute.py 的产物；BUILD.md 要求 compute.py 先跑。
with open(os.path.join(ROOT, "derived", "points.json"), encoding="utf-8") as f:
    POINTS = {p["id"]: p for p in json.load(f)["points"]}
with open(os.path.join(ROOT, "derived", "plan-value.json"), encoding="utf-8") as f:
    PLAN_VALUES = json.load(f)["plans"]


def point_of(row: dict) -> dict | None:
    return POINTS.get(f"{row['plan_id']}::{row['served_model']}")


def multiple_value(row: dict) -> float | None:
    """这份月额度按官方标价值几倍月费。缺标价或缺额度的行不进倍数图。"""
    p = point_of(row)
    return p["api_cost_multiple"] if p else None


def api_cost_cell(row: dict) -> str:
    """月额度按官方按量标价折成美元；括号内是"值几倍月费"。缺标价留 '-'，不补造。"""
    p = point_of(row)
    if not p or p["api_cost_usd_month"] is None:
        return "-"
    cell = f"{p['api_cost_usd_month']:,.0f}"
    if p["api_cost_multiple"]:
        cell += f" ({p['api_cost_multiple']:g}×)"
    if p["api_price_tier"] != "official":
        cell += "*"
    if p["api_cost_inherited"]:
        cell += "‡"
    return cell


def fee_band_rows(rows: list[dict], band: dict) -> list[dict]:
    """Partition by adopted USD monthly fee; never recompute adopted quotas."""
    result = []
    for row in rows:
        if row["billing"] != "subscription" or not row["monthly_tokens"] or not row["price_usd"]:
            continue
        fee = float(row["price_usd"])
        lower = fee >= band["min"] if band["minInclusive"] else fee > band["min"]
        upper = fee <= band["max"] if band["maxInclusive"] else fee < band["max"]
        if lower and upper:
            result.append(row)
    return result

if os.path.isfile("C:/Windows/Fonts/msyh.ttc"):
    font_manager.fontManager.addfont("C:/Windows/Fonts/msyh.ttc")
plt.rcParams["font.family"] = ["Microsoft YaHei", "Noto Sans CJK SC", "DejaVu Sans"]
plt.rcParams["axes.unicode_minus"] = False

VENDOR_OF = {
    "chatgpt": "OpenAI",
    "openai": "OpenAI",
    "claude": "Anthropic",
    "anthropic": "Anthropic",
    "supergrok": "xAI",
    "xai": "xAI",
    "cursor": "Cursor",
    "kimi": "Kimi",
    "glm": "GLM",
    "minimax": "MiniMax",
    "aliyun": "Alibaba",
    "opencode": "OpenCode",
    "command_code": "Command Code",
    "ollama": "Ollama",
    "deepseek": "DeepSeek",
    "stepfun": "StepFun",
    "devin": "Devin",
}
VENDOR_COLORS = {
    "OpenAI": "#00A86B",
    "Anthropic": "#F07826",
    "xAI": "#B65CFF",
    "Cursor": "#FFB81C",
    "Kimi": "#2FA8FF",
    "GLM": "#1E1E1E",
    "MiniMax": "#D23A7D",
    "Alibaba": "#FF6F61",
    "OpenCode": "#00C0A8",
    "Command Code": "#708090",
    "Ollama": "#A0785C",
    "DeepSeek": "#1F75FE",
    "Gemini": "#7CC12A",
    "StepFun": "#00F4E5",
    "Devin": "#7C3AED",
}
VIEW_CN = {"quotas": "额度", "prices": "单价", "multiple": "倍数", "plan_value": "套餐性价比"}
BOARD_CN = {
    "arena_code": "CodeArena榜",
    "arena_agent_mode": "AgentArena榜",
    "aa_intelligence_index": "AA智力榜",
    "aa_coding_agent_index": "AA编程Agent榜",
    "open_design_arena": "OpenDesign设计榜",
    "terminal_bench_4": "TB4终端榜",
}


def output_stem(view: str, board: dict | None, language: str, table: bool = False, fee_band: dict | None = None) -> str:
    """中文文件名：单价总览 / 前沿单价_Arena榜，英文版加 _英文，文字表加 表。"""
    base = f"前沿{VIEW_CN[view]}" if board else f"{VIEW_CN[view]}总览"
    if table:
        base += "表"
    if board:
        base += f"_{BOARD_CN[board['id']]}"
    if fee_band:
        base += f"_月费{fee_band['id']}美元"
    return base + ("_英文" if language == "en" else "")


VENDOR_CODES = {
    "OpenAI": "OA", "Anthropic": "AN", "xAI": "XA", "Cursor": "CU",
    "Kimi": "KI", "GLM": "GL", "MiniMax": "MM", "Alibaba": "AL",
    "OpenCode": "OC", "Command Code": "CC", "Ollama": "OL",
    "DeepSeek": "DS", "Gemini": "GE", "StepFun": "SF", "Devin": "DV",
}
TEXT = {
    "zh": {
        "quotas_title": "订阅额度总览 · 套餐 × 实际服务模型",
        "prices_title": "真实单价总览 · 订阅与 API 统一对比",
        "quotas_subtitle": "默认月 = 4 周，Kimi独立月池 = 周池×5；饱和使用；全口径 token；按量 API 无月额度",
        "prices_subtitle": "美元/credits与API三段价统一按97.5%缓存 / 2.15%输入 / 0.35%输出折算；直接total-token实测不重算",
        "quotas_axis": "月可用 token（亿，对数轴）",
        "prices_axis": "真实单价（美元 / 百万 token，对数轴）",
        "multiple_title": "订阅性价比总览 · 额度按API标价值几倍月费",
        "multiple_subtitle": "倍数 = 月额度按官方按量标价的成本 ÷ 订阅月费；1×为盈亏线，低于1×表示订阅比直接按量买同样token更贵",
        "multiple_axis": "订阅性价比倍数（API标价成本 ÷ 月费，对数轴）",
        "plan_value_title": "订阅性价比排名 · 一个套餐值几倍月费",
        "plan_value_subtitle": "每个套餐一条：多数模型共享的倍数；浅色延伸到该套餐最优模型；同套餐额度是互斥选项，不可相加",
        "plan_value_axis": "订阅性价比倍数（API标价成本 ÷ 月费，对数轴）",
        "plan_value_order": "性价比从高到低",
        "plan_value_note": "主数字 = 该套餐多数模型共享的倍数；深色条为主数字，浅色延伸段到该套餐最优模型，竖线为最差模型。多数模型共享同一数值，是因为它们的采用额度本就由同一基准模型按标价比推导，不是多次独立测量。",
        "plan_value_marks": "⚠ = 主数字覆盖不到一半模型，只是最常见值，须按区间读；* = 标价非厂商一手价目表；‡ = 主数字整组沿用同套餐基准模型。逐个模型的例外见同名文字表。不含缓存写入费，故均为下限。",
        "plan_value_shared": "共享",
        "plan_value_exception": "例外",
        "plan_value_headers": ["序号", "套餐", "渠道", "价格/月", "口径", "倍数", "API标价成本/月", "模型"],
        "quotas_order": "额度从高到低",
        "prices_order": "单价从低到高",
        "multiple_order": "倍数从高到低",
        "breakeven": "1× 盈亏线",
        "mixed_note": "03及以后保持对数轴；仅重画01、02，其像素长度分别为03的{ratio1:.1f}×和{ratio2:.1f}×。01超出左栏后沿左栏右缘折下，不再穿越右栏。",
        "footer": "颜色 = 套餐/API 提供方；置信度 [H] 高 / [M] 中 / [L] 低；编号为排序序号，同值依次列出，不代表模型能力排名。",
        "shared": "同套餐各模型额度不可相加。Claude Max (9/14+)：2026-09-14起永久额度估算，非当前活动期上限。数据：adopted.csv。",
        "headers": ["序号", "套餐", "价格/月", "服务模型", "月额度(亿)", "$/MTok", "API标价成本/月", "置信度"],
        "metered": "按量计费",
    },
    "en": {
        "quotas_title": "Monthly token allowance | Subscription plan x served model",
        "prices_title": "Effective token price | Subscriptions and APIs compared",
        "quotas_subtitle": "Default month = 4 weeks; Kimi monthly pool = 5× weekly; full utilization, all token types; APIs have no allowance",
        "prices_subtitle": "Dollar/credit and API rates use 97.5% cache / 2.15% input / 0.35% output; direct total-token measurements are not normalized",
        "quotas_axis": "Monthly tokens (billions, log scale)",
        "prices_axis": "Effective price (USD per million tokens, log scale)",
        "multiple_title": "Subscription value | What the allowance is worth in monthly fees at API list price",
        "multiple_subtitle": "Multiple = the allowance priced at official metered rates ÷ the monthly fee; 1x is break-even, below 1x the subscription costs more than buying the same tokens on the API",
        "multiple_axis": "Subscription value multiple (API list cost / monthly fee, log scale)",
        "plan_value_title": "Subscription value ranking | What one plan is worth in monthly fees",
        "plan_value_subtitle": "One bar per plan: the multiple its models share; the pale extension reaches the plan's best model; allowances inside a plan are alternatives, never additive",
        "plan_value_axis": "Subscription value multiple (API list cost / monthly fee, log scale)",
        "plan_value_order": "Highest value first",
        "plan_value_note": "The headline is the multiple shared by the largest set of the plan's models. The solid bar is that headline, the pale extension reaches the plan's best model and the tick marks its worst. Most models share one value because their adopted allowances were derived from a single base model by a list-price ratio, not measured independently.",
        "plan_value_marks": "⚠ = the headline covers fewer than half the plan's models, so it is only the most common value and must be read as a range; * = the rate is not a first-party rate card; ‡ = the whole headline group inherits from a sibling model. Per-model exceptions are in the matching text table. Cache writes are not modeled, so every figure is a floor.",
        "plan_value_shared": "shared",
        "plan_value_exception": "exception",
        "plan_value_headers": ["No.", "Plan", "Channel", "Monthly fee", "Group", "Multiple", "API cost/mo", "Models"],
        "quotas_order": "Highest allowance first",
        "prices_order": "Lowest price first",
        "multiple_order": "Highest multiple first",
        "breakeven": "1x break-even",
        "mixed_note": "Rows 03 onward stay on the log scale. Only rows 01–02 are redrawn at {ratio1:.1f}× and {ratio2:.1f}× row 03's pixel length; row 01 folds down at the right edge of the left column and never crosses the right column.",
        "footer": "Color = plan/API provider; confidence [H] high / [M] medium / [L] low; numbers indicate row order, not model capability. Ties listed sequentially.",
        "shared": "Allowances within a plan are not additive. Claude Max (9/14+): estimated permanent allowances from 2026-09-14, not current boosted limits. Source: adopted.csv.",
        "headers": ["No.", "Plan", "Monthly fee", "Served model", "Monthly tokens (B)", "USD/MTok", "API cost/mo", "Confidence"],
        "metered": "Pay-as-you-go",
    },
}


def vendor_of(plan_id: str) -> str:
    return next(name for prefix, name in VENDOR_OF.items() if plan_id.startswith(prefix))


def plan_name(row: dict, language: str) -> str:
    return display_plan_name(row["plan_name"], row["plan_id"], language)


def display_plan_name(name: str, plan_id: str, language: str) -> str:
    if name.startswith("GLM "):
        name = name.replace("老客", "v2").replace("新客", "v3")
    if plan_id.startswith("kimi_"):
        name += " †"
    if language == "en":
        for original, translated in {
            "Kimi 会员 ": "Kimi CN ",
            "新客": "New",
            "老客": "Existing",
            "阿里云百炼": "Alibaba Cloud CN",
            "闲时": "Off-peak",
            "中间值": "Midpoint",
            "忙时": "Peak",
        }.items():
            name = name.replace(original, translated)
        if plan_id.startswith("kimi_"):
            name = name.replace("Kimi CN ", "Kimi CN CNY ")
    return name


def text_width(s: str) -> int:
    return sum(2 if unicodedata.east_asian_width(c) in "WF" else 1 for c in s)


def pad(s: str, width: int) -> str:
    return s + " " * max(0, width - text_width(s))


def monthly_value(row: dict, language: str) -> float:
    return float(row["monthly_yi"]) / (10 if language == "en" else 1)


def sorted_rows(rows: list[dict], view: str) -> list[dict]:
    if view == "quotas":
        return sorted(
            (r for r in rows if r["billing"] == "subscription" and r["monthly_tokens"]),
            key=lambda r: -float(r["monthly_yi"]),
        )
    if view == "multiple":
        # 只画有官方标价、且有月额度的订阅行；缺标价的模型不进图，也不补造倍数。
        return sorted((r for r in rows if multiple_value(r)),
                      key=lambda r: -multiple_value(r))
    return sorted(rows, key=lambda r: float(r["real_usd_per_mtok"]))


def frontier_rows(rows: list[dict], points: list[dict], board: str) -> list[dict]:
    index = {p["id"]: p for p in points}
    candidates = []
    for row in rows:
        point = index.get(f"{row['plan_id']}::{row['served_model']}")
        if point is None or point.get(f"{board}__score") is None or float(row["real_usd_per_mtok"]) <= 0:
            continue
        if float(row["real_usd_per_mtok"]) != point["real_usd_per_mtok"]:
            raise ValueError("derived/points.json is stale; run scripts/compute.py first")
        candidates.append({**row, "board_score": point[f"{board}__score"],
                           "board_variant": point[f"{board}__variant"],
                           "board_harness": point[f"{board}__agent_harness"],
                           "board_effort": point[f"{board}__reasoning_effort"],
                           "board_mapping": point[f"{board}__mapping_kind"],
                           "board_mapping_confidence": point[f"{board}__mapping_confidence"],
                           "board_mapping_note": point[f"{board}__mapping_note"]})
    return [row for row in candidates if not any(
        float(other["real_usd_per_mtok"]) <= float(row["real_usd_per_mtok"])
        and other["board_score"] >= row["board_score"]
        and (float(other["real_usd_per_mtok"]) < float(row["real_usd_per_mtok"])
             or other["board_score"] > row["board_score"])
        for other in candidates
    )]


def frontier_caption(board: dict) -> str:
    return f"{board['name']} | {board['metric']} | {board['snapshot']}"


def frontier_rule(language: str) -> str:
    if language == "zh":
        return "前沿按全量订阅/API的单价与得分筛选，非额度排名；同价同分套餐均保留；缺分模型不参与，估算不确定性未纳入筛选。"
    return "Selected by price and score across all subscriptions/APIs, not by allowance. Equivalent plans retained; unscored models excluded; uncertainty not modeled."


def evidence_note(language: str) -> str:
    if language == "zh":
        return "† Kimi：¥199的K3点以K3-256K为主，约84%反推周池×5得14.51亿；K2.7纯样本11.9M/月0.76%得15.68亿；其余档按官方倍率推算。OpenCode Go按官方美元池和三段价套统一标准负载换算。"
    return "† Kimi: CNY199 K3 uses a K3-256K-dominant / ~84% weekly sample ×5 = 1.451B; pure K2.7 uses 11.9M / 0.76% = 1.568B. Other tiers are scaled by official ratios. OpenCode Go uses official dollar pools and rates under the standard workload."


def api_cost_note(language: str) -> str:
    """把 API 成本列的口径、来源分级和循环推导风险一次说清，不让读者误读。"""
    if language == "zh":
        return ("API标价成本/月 = 该行采用月额度 × 官方按量三段标价（按同一标准负载加权）；括号内为该金额 ÷ 订阅月费，"
                "即这份额度按标价值几倍月费；小于1×表示订阅比直接按量买同样的token更贵。"
                "* = 标价非厂商一手价目表（厂商页面JS渲染或仅开放权重，取具名网关/追踪站，置信度低）；"
                "‡ = 该行额度本身由同套餐基准模型按标价比推导，成本数字与基准行相同，不是该模型的独立证据。"
                "- = 未找到可辩护的公开标价，留空不补造。不含缓存写入费，故为下限。")
    return ("API cost/mo = this row's adopted monthly allowance priced at the provider's official metered rates "
            "(same standard workload weighting); the bracketed figure is that amount ÷ the monthly fee, i.e. how many "
            "times the subscription fee the same tokens would cost at list price. Below 1× means the subscription costs "
            "more than buying the same tokens on the API. "
            "* = the rate is not a first-party rate card (vendor page is JS-rendered or the model is open-weight; a named "
            "gateway or tracker is used, low confidence); "
            "‡ = this row's allowance was itself derived from a sibling model by a list-price ratio, so the figure repeats "
            "that row and is not independent evidence for this model. "
            "- = no defensible public rate found; left blank rather than invented. Cache writes are not modeled, so the figure is a floor.")


def exchange_note(language: str) -> str:
    fx = CONVENTIONS["exchangeRate"]
    rate = CONVENTIONS["usdPerCny"]
    if language == "zh":
        return f"汇率：1 USD = {rate:g} CNY（{fx['date']}，{fx['labelZh']}）；人民币月费 ÷ 汇率换算美元。"
    return f"FX: 1 USD = {rate:g} CNY ({fx['date']}, {fx['labelEn']}); CNY monthly fees divided by this rate."


def write_text_table(rows: list[dict], view: str, language: str, board: dict | None = None, fee_band: dict | None = None) -> None:
    text = TEXT[language]
    head = text["headers"] + ([board["metric"], "得分版本" if language == "zh" else "Score variant",
                                "Harness", "思考强度" if language == "zh" else "Reasoning effort",
                                "映射" if language == "zh" else "Mapping"] if board else [])
    body = [
        [
            str(i), plan_name(r, language),
            f"{r['currency']} {r['price']}" if r["price"] else text["metered"],
            DISPLAY.get(r["served_model"], r["served_model"]),
            f"{monthly_value(r, language):g}" if r["monthly_tokens"] else "-",
            r["real_usd_per_mtok"], api_cost_cell(r), r["confidence"],
        ] + ([f"{r['board_score']:g}", r["board_variant"], r["board_harness"] or "—",
              r["board_effort"] or "—", r["board_mapping"]] if board else [])
        for i, r in enumerate(rows, 1)
    ]
    widths = [max(text_width(c) for c in [h] + [b[i] for b in body])
              for i, h in enumerate(head)]
    line = "  ".join(pad(h, w) for h, w in zip(head, widths)).rstrip()
    sep = "  ".join("-" * w for w in widths)
    out = [text[f"{view}_title"], text[f"{view}_subtitle"], text["shared"],
           text["footer"], api_cost_note(language), evidence_note(language), exchange_note(language),
           ("汇率来源：" if language == "zh" else "FX source: ") + CONVENTIONS["exchangeRate"]["source"], line, sep] + [
        "  ".join(pad(c, w) for c, w in zip(b, widths)).rstrip() for b in body
    ]
    if board:
        out = [frontier_caption(board), frontier_rule(language)] + out
    if fee_band:
        out.insert(0, ("订阅月费：" if language == "zh" else "Monthly subscription fee: ") + fee_band["labelZh" if language == "zh" else "labelEn"])
    path = os.path.join(OUT_DIR, output_stem(view, board, language, table=True, fee_band=fee_band) + ".txt")
    with open(path, "w", encoding="utf-8") as f:
        f.write("\n".join(out) + "\n")
    print(f"wrote {len(rows)} rows -> {path}")


def plan_flags(plan: dict) -> str:
    """把"不能照字面读"的三件事压成短标记：跨模型差异大、非一手标价、整组沿用基准。"""
    flags = "⚠" if plan["varies"] else ""
    if plan["headline"]["third_party_rate"]:
        flags += "*"
    if plan["headline"]["inherited"]:
        flags += "‡"
    return flags


def plot_plan_value(plans: list[dict], language: str) -> None:
    """一个套餐一条，按订阅性价比从高到低。

    主数字是套餐内多数模型共享的倍数；浅色延伸段给出该套餐最优模型，竖线给出最差模型，
    这样"选哪个模型"的差距和"套餐整体值多少"能同时看到，而不必把互斥额度加起来。
    """
    text = TEXT[language]
    values = [p["headline_multiple"] for p in plans]
    ncols = 2
    half = (len(plans) + ncols - 1) // ncols
    figsize = (24, max(11, half * 0.52 + 3.4))
    fig, axes = plt.subplots(1, ncols, figsize=figsize, sharex=True, squeeze=False)
    axes = axes[0]
    fig.subplots_adjust(left=0.235, right=0.99, top=1 - 1.9 / figsize[1],
                        bottom=2.45 / figsize[1], wspace=1.16)
    lo = min(min(values), min(p["worst_multiple"] for p in plans)) * 0.55
    hi = max(max(values), max(p["best_multiple"] for p in plans)) * 7

    for col, ax in enumerate(axes):
        chunk = plans[col * half:col * half + half]
        start = col * half
        for i, plan in enumerate(chunk):
            color = VENDOR_COLORS[vendor_of(plan["plan_id"])]
            headline, best, worst = plan["headline_multiple"], plan["best_multiple"], plan["worst_multiple"]
            # 浅色段先画：最优模型能到哪里，深色主数字压在上面。
            if best > headline:
                ax.barh(i, best - lo, left=lo, color=color, alpha=0.26, height=0.62)
                ax.plot([best, best], [i - 0.31, i + 0.31], color=color, lw=1.4, alpha=0.85)
            ax.barh(i, headline - lo, left=lo, color=color, height=0.62)
            if worst < headline:
                ax.plot([worst, worst], [i - 0.31, i + 0.31], color="#20252B", lw=1.1)
            annotation = f"{headline:g}×  ${plan['headline_cost_usd_month']:,.0f}{plan_flags(plan)}"
            if best > headline or worst < headline:
                annotation += f"   {worst:g}–{best:g}×"
            ax.text(best * 1.06 if best > headline else headline * 1.06, i, annotation,
                    va="center", fontsize=9.5, color="#20252B",
                    bbox=dict(facecolor="white", alpha=0.72, edgecolor="none", pad=1.0))
        labels = [
            f"{start + i:02d}. {display_plan_name(p['plan'], p['plan_id'], language)}"
            f"  ${p['fee_usd']:g} · {p['model_count']}"
            + ("个模型" if language == "zh" else " models")
            for i, p in enumerate(chunk, 1)
        ]
        ax.set_yticks(range(len(chunk)), labels, fontsize=10)
        ax.tick_params(axis="y", length=0, pad=8)
        ax.set_ylim(half - 0.4, -0.8)
        ax.set_xscale("log")
        ax.set_xlim(lo, hi)
        ax.set_xlabel(text["plan_value_axis"], fontsize=10, labelpad=10)
        ax.set_axisbelow(True)
        ax.grid(axis="x", which="major", color="#E3E6E8", linewidth=0.7)
        ax.tick_params(axis="x", which="minor", length=0)
        for side in ("top", "right", "left"):
            ax.spines[side].set_visible(False)
        ax.spines["bottom"].set_color("#C3C9CE")
        if lo < 1 < hi:
            ax.axvline(1, color="#C0392B", linewidth=1.1, linestyle="--", zorder=2)
            ax.text(1, -0.74, text["breakeven"], color="#C0392B", fontsize=9,
                    ha="center", va="bottom", fontweight="bold")
        ax.set_title(f"{start + 1:02d}–{start + len(chunk):02d}  |  {text['plan_value_order']}",
                     fontsize=11, loc="left", pad=14)

    fig.suptitle(text["plan_value_title"], fontsize=21, y=1 - 0.22 / figsize[1], fontweight="bold")
    fig.text(0.5, 1 - 0.72 / figsize[1], text["plan_value_subtitle"],
             ha="center", fontsize=11, color="#505A64")
    providers = {vendor_of(p["plan_id"]) for p in plans}
    legend = [(name, c) for name, c in VENDOR_COLORS.items() if name in providers]
    handles = [plt.Rectangle((0, 0), 1, 1, color=c) for _, c in legend]
    fig.legend(handles, [f"{VENDOR_CODES[name]}  {name}" for name, _ in legend], loc="lower center",
               bbox_to_anchor=(0.5, 1 - 1.28 / figsize[1]), ncol=len(legend),
               fontsize=11, frameon=False, handlelength=1.6, columnspacing=1.8)
    notes = [text["plan_value_note"], text["plan_value_marks"], text["shared"], exchange_note(language)]
    for y, note in zip((1.52, 1.14, 0.76, 0.38), notes):
        fig.text(0.5, y / figsize[1], note, ha="center", fontsize=8.5, color="#505A64")

    stem = output_stem("plan_value", None, language)
    for ext in ("svg", "png"):
        fig.savefig(os.path.join(OUT_DIR, f"{stem}.{ext}"), dpi=160)
    plt.close(fig)
    print(f"wrote {len(plans)} plans -> {stem}.png/.svg")


def write_plan_value_table(plans: list[dict], language: str) -> None:
    """一行一个"套餐 × 价值组"：共享行给主数字，例外行逐个单列，不并进主数字。"""
    text = TEXT[language]
    head = text["plan_value_headers"]
    body = []
    for i, plan in enumerate(plans, 1):
        groups = [("plan_value_shared", plan["headline"])] + [("plan_value_exception", g) for g in plan["exceptions"]]
        for j, (kind, group) in enumerate(groups):
            marks = ("*" if group["third_party_rate"] else "") + ("‡" if group["inherited"] else "")
            body.append([
                f"{i}" if j == 0 else "",
                display_plan_name(plan["plan"], plan["plan_id"], language) + plan_flags(plan) if j == 0 else "",
                plan["channel"] if j == 0 else "",
                f"USD {plan['fee_usd']:g}" if j == 0 else "",
                text[kind],
                f"{group['multiple']:g}×{marks}",
                f"{group['cost']:,.0f}",
                ", ".join(group["models"]),
            ])
    widths = [max(text_width(c) for c in [h] + [b[k] for b in body]) for k, h in enumerate(head)]
    line = "  ".join(pad(h, w) for h, w in zip(head, widths)).rstrip()
    sep = "  ".join("-" * w for w in widths)
    out = [text["plan_value_title"], text["plan_value_subtitle"], text["plan_value_note"],
           text["plan_value_marks"], text["shared"], exchange_note(language),
           ("汇率来源：" if language == "zh" else "FX source: ") + CONVENTIONS["exchangeRate"]["source"],
           line, sep] + ["  ".join(pad(c, w) for c, w in zip(b, widths)).rstrip() for b in body]
    path = os.path.join(OUT_DIR, output_stem("plan_value", None, language, table=True) + ".txt")
    with open(path, "w", encoding="utf-8") as f:
        f.write("\n".join(out) + "\n")
    print(f"wrote {len(plans)} plans / {len(body)} value groups -> {path}")


def annotation_of(row: dict, value: float, view: str, language: str,
                  board: dict | None) -> str:
    if view == "quotas":
        value_label = f"{value:g}"
    elif view == "multiple":
        # 倍数图里同时给出美元金额，否则读者只看到倍数、不知道基数多大。
        point = point_of(row)
        value_label = f"{value:g}×  ${point['api_cost_usd_month']:,.0f}"
        if point["api_price_tier"] != "official":
            value_label += "*"
        if point["api_cost_inherited"]:
            value_label += "‡"
    else:
        value_label = f"${value:g}"
    confidence = row["confidence"][0].upper()
    channel = VENDOR_CODES[vendor_of(row["plan_id"])]
    annotation = f"{value_label}  {channel} [{confidence}]"
    if board:
        score = f"{row['board_score']:+g}%" if "%" in board["metric"] else f"{row['board_score']:g}"
        annotation += f"\n{'得分' if language == 'zh' else 'Score'}: {score}"
    return annotation


def _fig_y(ax, y, fig) -> float:
    return ax.transData.transform((0, y))[1] / fig.bbox.height


def _fig_box(y0, h, ax, fig):
    y_a = _fig_y(ax, y0, fig)
    y_b = _fig_y(ax, y0 + h, fig)
    return (min(y_a, y_b), abs(y_b - y_a))


def draw_mixed_vs_third(fig, axes, mixed, baseline, view, language) -> None:
    """03起保持对数；01、02按对03的像素倍数重画，超长部分在左栏右缘折下。"""
    fig.canvas.draw()
    tax = axes[0]
    fw, fh = fig.bbox.width, fig.bbox.height
    bars, values, rows = mixed["bars"], mixed["values"], mixed["rows"]
    ref = values[2]
    x0_fig = tax.transData.transform((baseline, 0))[0] / fw
    x1_fig = tax.bbox.x1 / fw
    ref_len = tax.transData.transform((ref, 0))[0] / fw - x0_fig

    def add_rect(x, y, w, h, color, alpha=1.0, z=6):
        if w <= 1e-4 or h <= 1e-4:
            return
        fig.add_artist(plt.Rectangle(
            (x, y), w, h, transform=fig.transFigure,
            facecolor=color, alpha=alpha, lw=0, clip_on=False, zorder=z))

    for j in (0, 1):
        color = VENDOR_COLORS[vendor_of(rows[j]["plan_id"])]
        ratio = values[j] / ref
        y_fig, h_fig = _fig_box(bars[j].get_y(), bars[j].get_height(), tax, fig)
        target = ref_len * ratio
        horizontal = min(target, x1_fig - x0_fig)
        add_rect(x0_fig, y_fig, horizontal, h_fig, color)
        drop = max(0.0, (target - horizontal) * fw / fh)
        if drop:
            fold_x = x1_fig - h_fig
            add_rect(fold_x, y_fig - drop, h_fig, drop + h_fig, color, alpha=0.28, z=7)
        ann = annotation_of(rows[j], values[j], view, language, None)
        ann += f"  = {ratio:.1f}×03"
        fig.text(x1_fig - 0.006 if drop else x0_fig + horizontal + 0.004,
                 y_fig + h_fig / 2, ann, transform=fig.transFigure,
                 ha="right" if drop else "left", va="center", fontsize=9.5,
                 fontweight="bold", color="#20252B", zorder=23,
                 bbox=dict(facecolor="white", alpha=0.9, edgecolor="none", pad=0.8))


def plot(rows: list[dict], view: str, language: str, board: dict | None = None,
         mixed_scale: bool = False, fee_band: dict | None = None) -> None:
    text = TEXT[language]
    values = [monthly_value(r, language) if view == "quotas"
              else multiple_value(r) if view == "multiple"
              else float(r["real_usd_per_mtok"]) for r in rows]
    ncols = 1 if board else 2
    half = (len(rows) + ncols - 1) // ncols
    mixed_scale = bool(mixed_scale and view == "quotas" and board is None and ncols == 2)
    mixed = None
    if board:
        figsize = (18, 10)
    else:
        # 两栏总览保持每行约 0.28 英寸的有效高度；数据增长时自动增高。
        figsize = (24, max(8, half * 0.38 + 3.2)) if fee_band else (24, max(18, half * 0.31 + 3.2))
    fig, axes = plt.subplots(1, ncols, figsize=figsize,
                             sharex=True, squeeze=False)
    axes = axes[0]
    if board:
        fig.subplots_adjust(left=0.35, right=0.98, top=0.81, bottom=0.20)
    else:
        fig.subplots_adjust(left=0.205, right=0.99, top=0.90, bottom=0.09, wspace=1.04)
    if fee_band:
        fig.subplots_adjust(top=1 - 1.65 / figsize[1], bottom=2.0 / figsize[1])
    baseline = min(values) * 0.60
    # 前沿额度图的最大条目仍需给右侧数值/置信度留出完整文本宽度。
    xhi = max(values) * (2.20 if view == "quotas" and board else
                         1.40 if view == "quotas" else
                         8 if view == "multiple" else (8 if board else 12))

    for col, ax in enumerate(axes):
        start = col * half
        chunk = rows[start:start + half]
        chunk_values = values[start:start + half]
        colors = [VENDOR_COLORS[vendor_of(r["plan_id"])] for r in chunk]
        bars = ax.barh(range(len(chunk)), [v - baseline for v in chunk_values],
                       left=baseline, color=colors, height=0.67)
        if mixed_scale and col == 0:
            for j in (0, 1):
                bars[j].set_visible(False)
            mixed = {"bars": list(bars), "values": chunk_values, "rows": chunk}
        separator = "\n" if board else " · "
        labels = [
            f"{start + i:02d}. " + (plan_name(r, language) if r["billing"] == "metered"
                                   else f"{plan_name(r, language)}{separator}{r['board_variant'] if board else DISPLAY.get(r['served_model'], r['served_model'])}")
            for i, r in enumerate(chunk, 1)
        ]
        ax.set_yticks(range(len(chunk)), labels, fontsize=12 if board else 10)
        ax.tick_params(axis="y", length=0, pad=8)
        ax.set_ylim(half - 0.3, -0.8)
        ax.set_xscale("log")
        ax.set_xlim(baseline, xhi)
        ax.set_xlabel(text[f"{view}_axis"], fontsize=10, labelpad=10)
        ax.set_axisbelow(True)
        ax.grid(axis="x", which="major", color="#E3E6E8", linewidth=0.7)
        ax.tick_params(axis="x", which="minor", length=0)
        for side in ("top", "right", "left"):
            ax.spines[side].set_visible(False)
        ax.spines["bottom"].set_color("#C3C9CE")
        if view == "multiple" and baseline < 1 < xhi:
            # 盈亏线：右侧的条便宜于按量买，左侧的条比按量买还贵。
            ax.axvline(1, color="#C0392B", linewidth=1.1, linestyle="--", zorder=2)
            ax.text(1, -0.72, text["breakeven"], color="#C0392B", fontsize=9,
                    ha="center", va="bottom", fontweight="bold")
        ax.set_title(f"{start + 1:02d}–{start + len(chunk):02d}  |  {text[f'{view}_order']}",
                     fontsize=11, loc="left", pad=14)
        for j, (bar, value, row) in enumerate(zip(bars, chunk_values, chunk)):
            if mixed_scale and col == 0 and j < 2:
                continue
            ax.text(value * 1.03, bar.get_y() + bar.get_height() / 2,
                    annotation_of(row, value, view, language, board),
                    va="center", fontsize=11 if board else 9.5, color="#20252B",
                    zorder=15 if mixed_scale else 3,
                    bbox=dict(facecolor="white", alpha=0.72, edgecolor="none", pad=1.0))

    title = text[f"{view}_title"]
    if fee_band:
        title += " | " + ("月费 " if language == "zh" else "Monthly fee ") + fee_band["labelZh" if language == "zh" else "labelEn"].replace("$", r"\$")
    if mixed_scale:
        title += " · 混合比例" if language == "zh" else " | mixed scale"
    if board:
        title = ("最高配置参考前沿 · " if language == "zh" else "Top-configuration reference frontier | ") + title
    fig.suptitle(title, fontsize=18 if board else 21, y=1 - 0.15 / figsize[1] if fee_band else 0.978, fontweight="bold")
    fig.text(0.5, 1 - 0.65 / figsize[1] if fee_band else 0.925 if board else 0.952,
             frontier_caption(board) if board else text[f"{view}_subtitle"],
             ha="center", fontsize=10 if board else 11, color="#505A64")
    providers = {vendor_of(r["plan_id"]) for r in rows}
    legend = [(name, color) for name, color in VENDOR_COLORS.items() if name in providers]
    handles = [plt.Rectangle((0, 0), 1, 1, color=color) for _, color in legend]
    fig.legend(handles, [f"{VENDOR_CODES[name]}  {name}" for name, _ in legend], loc="lower center",
               bbox_to_anchor=(0.5, 1 - 1.2 / figsize[1] if fee_band else 0.86 if board else 0.916), ncol=len(legend),
               fontsize=11, frameon=False, handlelength=1.6, columnspacing=1.8)
    if board:
        footnotes = [frontier_rule(language), text["shared"], text["footer"], exchange_note(language)]
        for y, note in zip((0.115, 0.085, 0.055, 0.025), footnotes):
            fig.text(0.5, y, note, ha="center", fontsize=8, color="#505A64")
    elif fee_band:
        for y, note in zip((1.05, 0.77, 0.49, 0.21), [text["footer"], text["shared"], evidence_note(language), exchange_note(language)]):
            fig.text(0.5, y / figsize[1], note, ha="center", fontsize=9, color="#505A64")
    else:
        y0 = 0.062
        if mixed_scale:
            mixed_note = text["mixed_note"].format(
                ratio1=values[0] / values[2], ratio2=values[1] / values[2])
            fig.text(0.5, 0.076, mixed_note, ha="center", fontsize=9, color="#505A64")
        fig.text(0.5, y0, text["footer"], ha="center", fontsize=9, color="#505A64")
        fig.text(0.5, y0 - 0.018, text["shared"], ha="center", fontsize=9, color="#505A64")
        fig.text(0.5, y0 - 0.036, evidence_note(language), ha="center", fontsize=9, color="#505A64")
        fig.text(0.5, y0 - 0.054, exchange_note(language), ha="center", fontsize=9, color="#505A64")
    if mixed:
        draw_mixed_vs_third(fig, axes, mixed, baseline, view, language)
    stem = output_stem(view, board, language, fee_band=fee_band) + ("_混合比例" if mixed_scale else "")
    for ext in ("png", "svg"):
        fig.savefig(os.path.join(OUT_DIR, f"{stem}.{ext}"), dpi=160)
    plt.close(fig)
    print(f"wrote {len(rows)} rows -> {stem}.png/.svg")


def main() -> None:
    with open(ADOPTED, encoding="utf-8-sig") as f:
        # 不计额度（$0）点无 token 分母且无法上对数条形图，总览与前沿精简版不画；只在帕累托图上以专用刻度位呈现。
        rows = [r for r in csv.DictReader(f) if r["real_usd_per_mtok"] and float(r["real_usd_per_mtok"]) > 0]
    os.makedirs(OUT_DIR, exist_ok=True)
    for band in FEE_BANDS:
        selected = sorted_rows(fee_band_rows(rows, band), "quotas")
        if selected:
            for language in ("zh", "en"):
                write_text_table(selected, "quotas", language, fee_band=band)
                plot(selected, "quotas", language, fee_band=band)
    import sys
    if "--fee-bands-only" in sys.argv:
        return
    for view in ("quotas", "prices", "multiple"):
        ordered = sorted_rows(rows, view)
        for language in ("zh", "en"):
            write_text_table(ordered, view, language)
            plot(ordered, view, language)
            if view == "quotas":
                plot(ordered, view, language, mixed_scale=True)
    # 套餐级性价比：一个套餐一条，取自 compute.py 的 derived/plan-value.json。
    for language in ("zh", "en"):
        write_plan_value_table(PLAN_VALUES, language)
        plot_plan_value(PLAN_VALUES, language)
    with open(os.path.join(ROOT, "derived", "points.json"), encoding="utf-8") as f:
        data = json.load(f)
    selections = {}
    for board_id, meta in data["boards"].items():
        board = {**meta, "id": board_id}
        selected = frontier_rows(rows, data["points"], board_id)
        selections[board_id] = {
            **meta,
            "frontier": [{"id": f"{r['plan_id']}::{r['served_model']}", "model": r["served_model"],
                          "price_usd_per_mtok": float(r["real_usd_per_mtok"]),
                          "score": r["board_score"], "variant": r["board_variant"],
                          "agent_harness": r["board_harness"], "reasoning_effort": r["board_effort"],
                          "mapping_kind": r["board_mapping"],
                          "mapping_confidence": r["board_mapping_confidence"],
                          "mapping_note": r["board_mapping_note"],
                          "confidence": r["confidence"]} for r in sorted_rows(selected, "prices")],
            "unscored": [p["id"] for p in data["points"] if p.get(f"{board_id}__score") is None],
        }
        for view in ("quotas", "prices"):
            ordered = sorted_rows(selected, view)
            if not ordered:
                continue
            for language in ("zh", "en"):
                write_text_table(ordered, view, language, board)
                plot(ordered, view, language, board)
    with open(os.path.join(OUT_DIR, "前沿筛选结果.json"), "w", encoding="utf-8") as f:
        json.dump({"criterion": frontier_rule("en"), "boards": selections}, f, ensure_ascii=False, indent=2)


if __name__ == "__main__":
    main()
