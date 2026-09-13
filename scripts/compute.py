# -*- coding: utf-8 -*-
"""adopted.csv × 榜单分数 × 官方标价 → derived/points.csv + points.json。

每个点 = (套餐, 实际服务模型)。x = 真实单价 $/MTok；y = 该模型在各榜单的分数（同模型多个 effort 变体取最高分）。
d = 真实单价 / 标价混合单价（标价按项目统一标准负载折算），只作注释，不进图。
api_cost_usd_month = 采用月额度 × 标价混合单价：同样的 token 按官方按量标价要花多少钱；
api_cost_multiple = 该金额 ÷ 订阅月费 = 1/d，即"订阅额度值几倍月费"。缺标价的模型留空，不补造。
"""
from __future__ import annotations

import csv
import json
import re
from pathlib import Path
from benchmark_configs import configuration, candidates, score_fields

ROOT = Path(__file__).resolve().parent.parent
DATA, RESEARCH, OUT = ROOT / "data", ROOT / "data" / "research", ROOT / "derived"
CONVENTIONS = json.loads((DATA / "conventions.json").read_text(encoding="utf-8"))
STANDARD_MIX = CONVENTIONS["standardTokenMix"]
BOARDS = ("arena_code", "arena_agent_mode", "aa_intelligence_index", "aa_coding_agent_index", "open_design_arena", "terminal_bench_4")
SCORE_FILES = (
    "scores-2026-09.json",
    "scores-code-arena-round1-2026-09-06.json",
    "scores-aa-coding-agent-round1-2026-09-06.json",
    "scores-aa-round3-2026-09-09.json",
    "scores-open-design-round1-2026-09-09.json",
    "scores-terminal-bench4-round1-2026-09-10.json",
    "scores-terminal-bench4-round2-selfreport-2026-09-12.json",
)
# 官方标价档案，同样按"从旧到新"排列；同一模型后档覆盖前档，缺失的模型沿用旧档。
LIST_PRICE_FILES = (
    "list-prices-2026-09.json",
    "list-prices-deepseek-v41-round1-2026-09-09.json",
    "list-prices-round2-2026-09-09.json",
    "list-prices-deepseek-v41-round2-2026-09-10.json",
    "list-prices-stepfun-round1-2026-09-10.json",
    "list-prices-astra-round1-2026-09-13.json",
)


def score_archives():
    return [json.loads((RESEARCH / name).read_text(encoding="utf-8"))
            for name in SCORE_FILES if (RESEARCH / name).exists()]

DISPLAY = {
    "gpt-5.6-sol": "GPT 5.6 Sol", "gpt-5.6-terra": "GPT 5.6 Terra", "gpt-5.6-luna": "GPT 5.6 Luna", "gpt-5.5": "GPT 5.5", "gpt-6-astra": "GPT-6 Astra",
    "claude-opus-5": "Claude Opus 5", "claude-fable-5": "Claude Fable 5", "claude-fable-5.1": "Claude Fable 5.1", "claude-sonnet-5": "Claude Sonnet 5", "claude-opus-4.8": "Claude Opus 4.8",
    "grok-4.6": "Grok 4.6", "grok-4.5": "Grok 4.5", "kimi-k3": "Kimi K3", "kimi-k2.7-code": "Kimi K2.7 Code", "kimi-k2.6": "Kimi K2.6",
    "glm-5.3": "GLM 5.3", "glm-5.3-flash": "GLM 5.3 Flash", "glm-5.2": "GLM 5.2", "glm-5.1": "GLM 5.1",
    "minimax-m3": "MiniMax M3", "minimax-m2.7": "MiniMax M2.7", "minimax-m2.5": "MiniMax M2.5",
    "qwen3.8-max": "Qwen3.8 Max", "qwen3.8-flash": "Qwen3.8 Flash", "qwen3.7-max": "Qwen3.7 Max",
    "qwen3.7-plus": "Qwen3.7 Plus", "qwen3.6-plus": "Qwen3.6 Plus",
    "deepseek-v4.1-flash": "DeepSeek V4.1 Flash", "deepseek-v4-flash": "DeepSeek V4 Flash", "deepseek-v4-flash-fast": "DeepSeek V4 Flash Fast", "deepseek-v4-pro": "DeepSeek V4 Pro",
    "deepseek-v4-flash-vision-exp": "DeepSeek V4 Flash Vision Exp",
    "gemini-3.1-pro": "Gemini 3.1 Pro", "gemini-3.7-flash": "Gemini 3.7 Flash", "gemini-3.8-flash": "Gemini 3.8 Flash",
    "mimo-v2.5": "MiMo V2.5", "mimo-v2.5-pro": "MiMo V2.5 Pro", "longcat-2.0": "LongCat 2.0",
    "muse-spark-1.3": "Muse Spark 1.3", "muse-spark-1.3-contributor": "Muse Spark 1.3 Contributor",
    "muse-spark-1.2": "Muse Spark 1.2", "muse-spark-1.2-contributor": "Muse Spark 1.2 Contributor",
    "glm-5.2-fast": "GLM 5.2 Fast", "inkling": "Inkling", "inkling-small": "Inkling Small",
    "kimi-k2.7-code-highspeed": "Kimi K2.7 Code HighSpeed", "nemotron-3-ultra": "Nemotron 3 Ultra",
    "qwen3.8-27b": "Qwen3.8 27B", "qwen3.8-max-0902": "Qwen3.8 Max 0902",
    "step-3.5-flash": "Step 3.5 Flash", "step-3.7-flash": "Step 3.7 Flash",
    "hy3": "Hy3", "hy4-preview": "Hy4 Preview", "omen-alpha": "Omen Alpha", "composer-2.5": "Composer 2.5",
    "swe-2": "SWE-2",
}
VENDOR = {
    "gpt": "OpenAI", "claude": "Anthropic", "grok": "xAI", "kimi": "Kimi", "glm": "Zhipu", "minimax": "MiniMax",
    "qwen": "Alibaba", "deepseek": "DeepSeek", "gemini": "Google", "mimo": "Xiaomi", "hy": "Tencent", "composer": "Cursor",
    "longcat": "Meituan", "muse": "Muse", "omen": "OpenCode", "step": "StepFun", "swe": "Cognition",
}


def vendor_of(model: str) -> str:
    return next((v for k, v in VENDOR.items() if model.startswith(k)), "other")


# build_adopted.py 里同套餐派生行的 source 形如 "由同套餐 claude-opus-5 157 亿 × 2.5"。
SIBLING_DERIVED = re.compile(r"^由同套餐 (\S+) ")


# 渠道前缀 → 渠道名；与 plot_quotas.py 的 VENDOR_OF 和 web/scripts/build-data.mjs 一致。
CHANNEL = {
    "chatgpt": "OpenAI", "openai": "OpenAI", "claude": "Anthropic", "anthropic": "Anthropic",
    "supergrok": "xAI", "xai": "xAI", "cursor": "Cursor", "kimi": "Kimi", "glm": "Zhipu",
    "minimax": "MiniMax", "aliyun": "Alibaba", "opencode": "OpenCode",
    "command_code": "Command Code", "ollama": "Ollama", "deepseek": "DeepSeek",
    "stepfun": "StepFun", "devin": "Devin",
}


def channel_of(plan_id: str) -> str:
    return next((name for prefix, name in CHANNEL.items() if plan_id.startswith(prefix)), "other")


def plan_values(points: list[dict], plan_ids: dict[str, str]) -> list[dict]:
    """按套餐汇总"订阅性价比"：多数模型共享的倍数，加上落在别处的模型。

    同套餐各模型额度是互斥选项，不可相加，所以套餐没有"总量"，只有"选一个模型能得到多少"。
    多数模型之所以共享同一个倍数，是因为它们的采用额度本就由同一个基准模型按标价比推导；
    真正另有依据的模型会落在别的数值上，这些就是 exceptions，必须单独列出而不是并进主数字。
    """
    by_plan: dict[str, list[dict]] = {}
    for p in points:
        if p["api_cost_multiple"] is None or p["billing"] == "metered":
            continue
        by_plan.setdefault(plan_ids[p["id"]], []).append(p)

    plans = []
    for plan_id, rows in by_plan.items():
        groups: dict[float, list[dict]] = {}
        for p in rows:
            groups.setdefault(p["api_cost_multiple"], []).append(p)

        def as_group(multiple: float, members: list[dict]) -> dict:
            return dict(
                multiple=multiple, cost=members[0]["api_cost_usd_month"],
                models=sorted(m["model_display"] for m in members),
                model_ids=sorted(m["model"] for m in members),
                # 整组都是派生行时，这个数值只是把基准行重复一遍，不是该组的独立证据。
                inherited=all(m["api_cost_inherited"] for m in members),
                third_party_rate=any(m["api_price_tier"] != "official" for m in members),
            )

        # 主数字取"共享模型数最多"的那一组；同样多时取倍数更高的一组。
        ranked = sorted(groups.items(), key=lambda kv: (-len(kv[1]), -kv[0]))
        headline = as_group(*ranked[0])
        exceptions = sorted((as_group(m, g) for m, g in ranked[1:]),
                            key=lambda g: -g["multiple"])
        ordered = sorted(rows, key=lambda p: -p["api_cost_multiple"])
        first = rows[0]
        plans.append(dict(
            plan_id=plan_id, plan=first["plan"], channel=channel_of(plan_id),
            fee_usd=first["price_usd"], headline_multiple=headline["multiple"],
            headline_cost_usd_month=headline["cost"], headline_models=headline["models"],
            headline_inherited=headline["inherited"],
            model_count=len(rows), value_group_count=len(groups),
            best_multiple=ordered[0]["api_cost_multiple"], best_model=ordered[0]["model_display"],
            worst_multiple=ordered[-1]["api_cost_multiple"], worst_model=ordered[-1]["model_display"],
            # 主数字覆盖不到一半模型时，它只是"最常见值"，不能当该套餐的代表值读。
            varies=len(headline["models"]) * 2 < len(rows),
            headline=headline, exceptions=exceptions,
        ))
    return sorted(plans, key=lambda p: (-p["headline_multiple"], p["plan"]))


def flag_inherited_api_cost(points: list[dict], base_of: dict[str, str]) -> None:
    """派生行的额度多半就是"基准模型额度 × 标价比"，其 API 成本会与基准行相同。

    这时 API 成本不是该模型的独立证据，只是把基准行的数字换个模型名重复一遍，必须标出来，
    否则读者会把同一笔证据当成多条。
    """
    cost = {p["id"]: p["api_cost_usd_month"] for p in points}
    for p in points:
        base = base_of.get(p["id"])
        mine, theirs = p["api_cost_usd_month"], cost.get(base)
        p["api_cost_inherited"] = bool(
            base and mine and theirs and abs(mine - theirs) <= 0.01 * theirs)


def load_scores() -> list[dict]:
    """Keep all configurations in each board's selected snapshot, never mix versions."""
    archives = [(name, json.loads((RESEARCH / name).read_text(encoding="utf-8")))
                for name in SCORE_FILES]
    return [configuration(record, name) for name, record in current_score_records(archives)]


def current_score_records(archives):
    # Files are explicitly ordered oldest to newest. A complete new board snapshot
    # replaces that board as a whole, including models removed from its coverage.
    # Archives flagged "supplement" only append rows (e.g. vendor self-reports) to the
    # current snapshot and never replace it.
    latest = {b["boardId"]: name for name, archive in archives for b in archive["boards"]
              if b["boardId"] in BOARDS and not archive.get("supplement")}
    return [(name, record) for name, archive in archives for record in archive["scores"]
            if latest.get(record["boardId"]) == name or archive.get("supplement")]


def load_list_prices() -> dict[str, dict]:
    """标价混合单价 + 来源分级。后档覆盖前档；三段价缺任一项的模型不给混合价，绝不补造。"""
    out: dict[str, dict] = {}
    for name in LIST_PRICE_FILES:
        archive = json.loads((RESEARCH / name).read_text(encoding="utf-8"))
        for m in archive["models"]:
            if m["input"] is None or m["output"] is None:
                # 明确记录为无公开标价：覆盖旧档的猜测，也让 API 成本列留空。
                out[m["model"]] = dict(blended=None, tier=m.get("priceTier", "unavailable"),
                                       confidence=m.get("priceConfidence"), source=m.get("source") or None,
                                       archive=name)
                continue
            cached = m["cachedInput"] if m["cachedInput"] is not None else m["input"] * 0.1
            rate = CONVENTIONS["usdPerCny"] if m.get("currency") == "CNY" else 1
            out[m["model"]] = dict(
                blended=(STANDARD_MIX["cache"] * cached + STANDARD_MIX["input"] * m["input"]
                         + STANDARD_MIX["output"] * m["output"]) / rate,
                # 旧档没有分级字段，按当时的口径一律视为官方标价。
                tier=m.get("priceTier", "official"), confidence=m.get("priceConfidence", "high"),
                source=m.get("source") or None, archive=name,
            )
    return out


def main() -> None:
    scores, list_prices = load_scores(), load_list_prices()
    boards_meta = {b["boardId"]: b for archive in score_archives() if not archive.get("supplement") for b in archive["boards"]}

    points, configuration_points, base_of, plan_ids = [], [], {}, {}
    with (DATA / "adopted.csv").open(encoding="utf-8-sig") as f:
        for r in csv.DictReader(f):
            model = r["served_model"]
            plan_ids[f"{r['plan_id']}::{model}"] = r["plan_id"]
            sibling = SIBLING_DERIVED.match(r["source"])
            if sibling:
                base_of[f"{r['plan_id']}::{model}"] = f"{r['plan_id']}::{sibling.group(1)}"
            real = float(r["real_usd_per_mtok"])
            listed = list_prices.get(model) or {}
            # 先定到发布精度再往下算：读者拿published标价×月额度必须能复现出published成本。
            lb = round(listed["blended"], 6) if listed.get("blended") else None
            fee = float(r["price_usd"]) if r["price_usd"] else None
            tokens = int(r["monthly_tokens"]) if r["monthly_tokens"] else None
            # 同一批 token 按官方按量标价的月成本；按量 API 行本身没有月额度，留空。
            api_cost = round(tokens / 1e6 * lb, 2) if lb and tokens else None
            p = dict(
                id=f"{r['plan_id']}::{model}", plan=r["plan_name"], billing=r["billing"], model=model,
                model_display=DISPLAY.get(model, model), vendor=vendor_of(model),
                label=r["plan_name"] if r["billing"] == "metered" else f"{DISPLAY.get(model, model)} · {r['plan_name']}",
                price_usd=fee, monthly_yi=float(r["monthly_yi"]) if r["monthly_yi"] else None,
                real_usd_per_mtok=real, list_blended_usd_per_mtok=lb,
                api_cost_usd_month=api_cost,
                api_cost_multiple=round(api_cost / fee, 2) if api_cost and fee else None,
                api_cost_inherited=False,  # 由 flag_inherited_api_cost 在全部行读完后判定
                api_price_tier=listed.get("tier"), api_price_confidence=listed.get("confidence"),
                api_price_source=listed.get("source"), api_price_archive=listed.get("archive"),
                d=round(real / lb, 4) if lb else None, confidence=r["confidence"], tier=r["chart_tier"], source=r["source"], note=r["decision_note"],
                unmetered=r.get("unmetered") == "true", promo_until=r.get("promo_until") or None,
            )
            for b in BOARDS:
                options = candidates(r, scores, b)
                # Explicit optional summary projection; full configuration rows are also published.
                selected = max(options, key=lambda s: s["score"], default=None)
                p[f"{b}__selection"] = "highest_archived_reference" if selected else None
                p[f"{b}__configuration_count"] = len(options)
                for field, value in score_fields(selected).items():
                    p[f"{b}__{field}"] = value
                for option in options:
                    configuration_points.append(dict(point_id=p["id"], board=b, **score_fields(option)))
            points.append(p)

    flag_inherited_api_cost(points, base_of)
    plans = plan_values(points, plan_ids)
    OUT.mkdir(exist_ok=True)
    (OUT / "benchmark-configurations.json").write_text(json.dumps(scores, ensure_ascii=False, indent=2), encoding="utf-8")
    (OUT / "benchmark-points.json").write_text(json.dumps(configuration_points, ensure_ascii=False, indent=2), encoding="utf-8")
    for name, records in (("benchmark-configurations", scores), ("benchmark-points", configuration_points)):
        with (OUT / (name + ".csv")).open("w", encoding="utf-8-sig", newline="") as f:
            fields = [k for k in records[0] if k != "raw_record"]
            writer = csv.DictWriter(f, fieldnames=fields, extrasaction="ignore")
            writer.writeheader()
            writer.writerows(records)
    with (OUT / "points.csv").open("w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(points[0].keys()))
        w.writeheader()
        w.writerows(points)
    (OUT / "plan-value.json").write_text(json.dumps(dict(
        generatedAt="2026-09-09",
        role="Per-subscription value: the API-list multiple the plan's models share, plus the models that differ.",
        rule=("Allowances inside a plan are alternatives, never additive, so a plan has no total. "
              "headline_multiple is the value shared by the largest set of the plan's priced models; "
              "exceptions are the remaining distinct values, each with its own models. "
              "varies=true means the headline covers fewer than half the plan's models and must be read "
              "as the most common value, not a representative one."),
        mix={k: round(v, 4) for k, v in STANDARD_MIX.items() if isinstance(v, (int, float))},
        listPriceArchives=list(LIST_PRICE_FILES), plans=plans,
    ), ensure_ascii=False, indent=1), encoding="utf-8")
    # 一行一个"套餐 × 价值组"，无损展开，便于直接排序和筛选。
    with (OUT / "plan-value.csv").open("w", encoding="utf-8-sig", newline="") as f:
        fields = ["plan_id", "plan", "channel", "fee_usd", "group", "multiple", "cost_usd_month",
                  "models", "model_count_in_group", "inherited", "third_party_rate",
                  "plan_model_count", "plan_value_group_count", "plan_varies",
                  "plan_best_multiple", "plan_best_model", "plan_worst_multiple", "plan_worst_model"]
        w = csv.DictWriter(f, fieldnames=fields)
        w.writeheader()
        for plan in plans:
            for kind, group in [("shared", plan["headline"])] + [("exception", g) for g in plan["exceptions"]]:
                w.writerow(dict(
                    plan_id=plan["plan_id"], plan=plan["plan"], channel=plan["channel"],
                    fee_usd=plan["fee_usd"], group=kind, multiple=group["multiple"],
                    cost_usd_month=group["cost"], models=" | ".join(group["models"]),
                    model_count_in_group=len(group["models"]), inherited=group["inherited"],
                    third_party_rate=group["third_party_rate"], plan_model_count=plan["model_count"],
                    plan_value_group_count=plan["value_group_count"], plan_varies=plan["varies"],
                    plan_best_multiple=plan["best_multiple"], plan_best_model=plan["best_model"],
                    plan_worst_multiple=plan["worst_multiple"], plan_worst_model=plan["worst_model"],
                ))
    (OUT / "points.json").write_text(json.dumps(dict(
        generatedAt="2026-09-13", mix={k: round(v, 4) for k, v in STANDARD_MIX.items() if isinstance(v, (int, float))},
        listPriceArchives=list(LIST_PRICE_FILES),
        boards={b: dict(name=boards_meta[b]["name"].replace("🏆 ", ""), metric=boards_meta[b]["metric"], url=boards_meta[b]["url"], snapshot=boards_meta[b]["snapshotDate"]) for b in BOARDS},
        points=points,
    ), ensure_ascii=False, indent=1), encoding="utf-8")

    unscored = {b: sorted({p["label"] for p in points if p[f"{b}__score"] is None}) for b in BOARDS}
    print(f"{len(points)} points -> {OUT}")
    for b in BOARDS:
        print(f"  {b}: {sum(p[f'{b}__score'] is not None for p in points)} scored, unscored: {unscored[b]}")
    priced = [p for p in points if p["api_cost_usd_month"] is not None]
    print(f"  api cost: {len(priced)} of {len(points)} rows priced; "
          f"{sum(p['list_blended_usd_per_mtok'] is None for p in points)} rows have no list price; "
          f"{sum(p['api_cost_inherited'] for p in points)} inherited from a sibling model")
    for t in ("official", "official_indirect", "third_party"):
        print(f"    {t}: {sum(p['api_price_tier'] == t for p in points)} rows")
    print(f"  unpriced models: {sorted({p['model'] for p in points if p['list_blended_usd_per_mtok'] is None})}")
    print(f"  plan value: {len(plans)} plans, {sum(p['varies'] for p in plans)} where value differs by model, "
          f"{sum(len(p['exceptions']) for p in plans)} exception groups")


if __name__ == "__main__":
    main()
