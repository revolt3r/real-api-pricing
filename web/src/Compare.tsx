import { useEffect, useMemo, useRef } from "react";
import { ArrowRight, MagnifyingGlass, X } from "@phosphor-icons/react";
import type { PlanComparison, ValueGroup } from "./domain";
import type { Row, SiteData, State } from "./types";
import type { ChartHandle } from "./Chart";
import { BrandMarks } from "./ProviderLogo";
import {
  color,
  defaultState,
  displayPlan,
  money,
  multiple,
  planComparisons,
  price,
  rowsFor,
  sortComparisons,
} from "./domain";

type Metric = "value" | "apiCost" | "fee";

const escape = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[
        c
      ]!,
  );

/** How many exception rows to spell out before collapsing the rest into a range.
 *  Wrapper plans resell dozens of models at dozens of rates; listing every one
 *  would bury the comparison the dashboard exists to make. */
const EXCEPTION_LIMIT = 4;

export default function Compare({
  data,
  rows,
  state,
  patch,
  onSelect,
  handle,
}: {
  data: SiteData;
  rows: Row[];
  state: State;
  patch: (next: Partial<State>) => void;
  onSelect: (rows: Row[]) => void;
  handle: React.RefObject<ChartHandle | null>;
}) {
  const zh = state.lang === "zh";
  const t = (en: string, cn: string) => (zh ? cn : en);
  const metric: Metric =
    state.sort === "apiCost" ? "apiCost" : state.sort === "fee" ? "fee" : "value";

  // The picker needs every plan, not only the ones the current filter leaves visible.
  const catalogue = useMemo(
    () =>
      sortComparisons(
        planComparisons(
          rowsFor(data, { ...defaultState(), lang: state.lang, view: "price" }),
        ),
        "value",
      ),
    [data, state.lang],
  );
  const shown = sortComparisons(planComparisons(rows), metric);

  const value = (p: PlanComparison) =>
    metric === "fee"
      ? (p.fee ?? 0)
      : metric === "apiCost"
        ? p.headline.cost
        : p.headline.multiple;
  const formatted = (p: PlanComparison) =>
    metric === "value"
      ? multiple(p.headline.multiple, state.lang)
      : money(value(p), state.lang);
  const groupValue = (g: ValueGroup) =>
    metric === "fee" ? 0 : metric === "apiCost" ? g.cost : g.multiple;
  const groupLabel = (g: ValueGroup) =>
    metric === "value" ? multiple(g.multiple, state.lang) : money(g.cost, state.lang);
  // The second line always carries the number the headline is not showing, so the
  // fee-relative and absolute views of the same plan are both on screen at once.
  const secondary = (m: number, cost: number) =>
    metric === "value"
      ? `${money(cost, state.lang)} ${t("of tokens at API list", "的 token（按 API 标价）")}`
      : metric === "apiCost"
        ? `${multiple(m, state.lang)} ${t("the monthly fee", "月费")}`
        : `${multiple(m, state.lang)} · ${money(cost, state.lang)} ${t("at API list", "按 API 标价")}`;

  // Linear, not logarithmic: this view compares a handful of plans against each other,
  // and a log axis would visually flatten a 7x difference in value into a short step.
  const high = Math.max(...shown.map(value), 0) || 1;
  const width = (v: number) => `${Math.max(0.6, (v / high) * 100)}%`;
  const breakEven = metric === "value" && high > 1 ? (1 / high) * 100 : null;

  // Distinct fees shared by more than one plan: one click sets up "$200 vs $200".
  const tiers = useMemo(() => {
    const byFee = new Map<number, PlanComparison[]>();
    for (const p of catalogue)
      if (p.fee !== null && p.currency === "USD")
        byFee.set(p.fee, [...(byFee.get(p.fee) || []), p]);
    return [...byFee.entries()]
      .filter(([, ps]) => ps.length > 1)
      .sort((a, b) => b[0] - a[0]);
  }, [catalogue]);

  const selectedNames = new Set(state.plans);
  const toggle = (plan: string) =>
    patch({
      plans: selectedNames.has(plan)
        ? state.plans.filter((p) => p !== plan)
        : [...state.plans, plan],
    });

  const unit =
    metric === "value"
      ? t("× the monthly fee", "× 月费")
      : metric === "apiCost"
        ? t("USD / month at API list", "美元 / 月（按 API 标价）")
        : t("USD / month", "美元 / 月");
  const title = t("Subscription comparison", "订阅对比");

  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = 0;
  }, [shown.length, metric]);

  useEffect(() => {
    handle.current = {
      download: async (format) => {
        const rowH = 96,
          w = 1180,
          h = 150 + Math.max(shown.length, 1) * rowH;
        const bar = (v: number) => (v / high) * 620;
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="100%" height="100%" fill="white"/><g font-family="Arial, Microsoft YaHei, sans-serif" fill="#20262e"><text x="32" y="42" font-size="23">${escape(title)}</text><text x="32" y="70" font-size="12" fill="#687382">${escape(
          `${shown.length} ${t("plans", "个套餐")} · ${unit} · ${t("bar = the value the plan's models share; exceptions listed under it", "条形 = 该套餐多数模型共享的价值；例外单列在下方")}`,
        )}</text>${
          breakEven === null
            ? ""
            : `<line x1="${420 + (breakEven / 100) * 620}" x2="${420 + (breakEven / 100) * 620}" y1="96" y2="${h - 30}" stroke="#C0392B" stroke-width="1" stroke-dasharray="4 3"/><text x="${420 + (breakEven / 100) * 620}" y="90" font-size="10" fill="#C0392B" text-anchor="middle">${escape(t("1x break-even", "1× 盈亏线"))}</text>`
        }${shown
          .map((p, i) => {
            const y = 130 + i * rowH;
            const c = color(p.headline.rows[0].point);
            const models = p.headline.rows
              .map((r) => r.point.model_display)
              .join(" · ");
            const exception = p.exceptions[0];
            return (
              `<text x="32" y="${y}" font-size="15">${escape(displayPlan(p.plan, state.lang))}</text>` +
              `<text x="32" y="${y + 20}" font-size="11" fill="#687382">${escape(`${p.channel} · ${price(p.fee)} / ${t("mo", "月")} · ${p.modelCount} ${t("models", "个模型")}`)}</text>` +
              `<text x="32" y="${y + 38}" font-size="10" fill="#8a94a0">${escape(models.slice(0, 64))}</text>` +
              `<rect x="420" y="${y - 12}" width="${bar(value(p))}" height="16" rx="3" fill="${c}"/>` +
              `<text x="1148" y="${y}" text-anchor="end" font-size="17">${escape(formatted(p))}</text>` +
              `<text x="1148" y="${y + 19}" text-anchor="end" font-size="11" fill="#687382">${escape(secondary(p.headline.multiple, p.headline.cost))}</text>` +
              (exception
                ? `<rect x="420" y="${y + 30}" width="${bar(groupValue(exception))}" height="8" rx="2" fill="${c}" opacity="0.42"/>` +
                  `<text x="1148" y="${y + 40}" text-anchor="end" font-size="11" fill="#687382">${escape(`${t("exception", "例外")} ${groupLabel(exception)} · ${exception.rows.map((r) => r.point.model_display).join("/")}${p.exceptions.length > 1 ? ` +${p.exceptions.length - 1}` : ""}`)}</text>`
                : "") +
              `<line x1="32" x2="1148" y1="${y + 58}" y2="${y + 58}" stroke="#edf0f3"/>`
            );
          })
          .join("")}</g></svg>`;
        const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
        let url = URL.createObjectURL(blob);
        try {
          if (format === "png") {
            const img = new Image();
            img.src = url;
            await img.decode();
            const canvas = document.createElement("canvas");
            canvas.width = w * 2;
            canvas.height = h * 2;
            const ctx = canvas.getContext("2d")!;
            ctx.scale(2, 2);
            ctx.drawImage(img, 0, 0);
            const png = await new Promise<Blob>((resolve, reject) =>
              canvas.toBlob(
                (b) => (b ? resolve(b) : reject(new Error("PNG export failed"))),
                "image/png",
              ),
            );
            URL.revokeObjectURL(url);
            url = URL.createObjectURL(png);
          }
          const link = document.createElement("a");
          link.href = url;
          link.download = `real-api-pricing-compare-${metric}-${state.lang}.${format}`;
          link.click();
        } finally {
          setTimeout(() => URL.revokeObjectURL(url), 1000);
        }
      },
    };
    return () => {
      handle.current = null;
    };
  });

  const chip = (r: Row) => (
    <span className="model-chip" key={r.point.id}>
      <BrandMarks point={r.point} />
      {r.point.model_display}
      {r.point.api_cost_inherited && (
        <i
          title={t(
            "Allowance derived from a sibling model by a list-price ratio, so this value repeats that row.",
            "额度由同套餐基准模型按标价比推导，此数值与基准行相同。",
          )}
        >
          ‡
        </i>
      )}
      {r.point.api_price_tier !== "official" && (
        <i
          title={t(
            "Rate is not a first-party rate card.",
            "标价非厂商一手价目表。",
          )}
        >
          *
        </i>
      )}
    </span>
  );

  return (
    <section className="web-compare" aria-label={title}>
      <div className="compare-controls">
        <div className="compare-tiers">
          <strong>{t("Compare at the same price", "同价位对比")}</strong>
          <div>
            {tiers.map(([fee, ps]) => {
              const names = ps.map((p) => p.plan);
              const active =
                names.every((n) => selectedNames.has(n)) &&
                state.plans.length === names.length;
              return (
                <button
                  key={fee}
                  className={active ? "tier active" : "tier"}
                  aria-pressed={active}
                  onClick={() => patch({ plans: active ? [] : names })}
                >
                  {price(fee)}
                  <small>
                    {ps.length} {t("plans", "个套餐")}
                  </small>
                </button>
              );
            })}
            {state.plans.length > 0 && (
              <button className="tier clear" onClick={() => patch({ plans: [] })}>
                <X size={13} />
                {t("All plans", "全部套餐")}
              </button>
            )}
          </div>
        </div>
        <div className="compare-metric">
          <strong>{t("Rank by", "排序依据")}</strong>
          <div>
            {(
              [
                ["value", t("Value (× fee)", "性价比（× 月费）")],
                ["apiCost", t("API list cost", "API 标价成本")],
                ["fee", t("Monthly fee", "订阅月费")],
              ] as [Metric, string][]
            ).map(([key, label]) => (
              <button
                key={key}
                className={metric === key ? "tier active" : "tier"}
                aria-pressed={metric === key}
                onClick={() =>
                  patch({
                    sort: key === "value" ? "multiple" : key,
                    direction: "desc",
                  })
                }
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <details className="compare-picker">
        <summary>
          <MagnifyingGlass size={15} />
          {state.plans.length
            ? t(
                `${state.plans.length} of ${catalogue.length} plans selected`,
                `已选 ${state.plans.length} / ${catalogue.length} 个套餐`,
              )
            : t(
                `All ${catalogue.length} plans — pick the ones to compare`,
                `全部 ${catalogue.length} 个套餐 — 勾选要对比的`,
              )}
        </summary>
        <div className="picker-grid">
          {catalogue.map((p) => (
            <label key={p.key}>
              <input
                type="checkbox"
                checked={selectedNames.has(p.plan)}
                onChange={() => toggle(p.plan)}
              />
              <span>
                <strong>{displayPlan(p.plan, state.lang)}</strong>
                <small>
                  {price(p.fee)} · {multiple(p.headline.multiple, state.lang)} ·{" "}
                  {p.modelCount} {t("models", "个模型")}
                </small>
              </span>
            </label>
          ))}
        </div>
      </details>

      <div className="compare-legend">
        {t(
          "The bar is the value the plan's models share. Allowances inside a plan are alternatives, never additive — you pick one model, you do not get the sum.",
          "条形为该套餐多数模型共享的价值。同套餐各模型额度是互斥选项，不可相加——你只能选其一，不是把它们加起来。",
        )}{" "}
        {metric === "value" &&
          t(
            "1× is break-even against buying the same tokens on the API.",
            "1× 为与直接按量购买同样 token 的盈亏线。",
          )}
      </div>

      <div
        className="compare-scroll"
        ref={scrollRef}
        tabIndex={0}
        role="region"
        aria-label={t(`${title}, scrollable`, `${title}，可滚动`)}
      >
        {/* Bars start at the container's left edge and span its full width, so the
            guide sits at the same fraction of the width as its value. */}
        {breakEven !== null && (
          <div
            className="break-even"
            style={{ left: `${breakEven}%` }}
            aria-hidden="true"
          >
            <span>{t("1× break-even", "1× 盈亏线")}</span>
          </div>
        )}
        {shown.length ? (
          shown.map((p) => (
            <article className="compare-plan" key={p.key}>
              <header>
                <div className="compare-identity">
                  <strong>{displayPlan(p.plan, state.lang)}</strong>
                  <small>
                    <i style={{ background: color(p.headline.rows[0].point) }} />
                    {p.channel} · {price(p.fee)}
                    {p.currency === "CNY" && ` (¥${p.originalPrice})`} /{" "}
                    {t("mo", "月")} · {p.modelCount} {t("models", "个模型")}
                  </small>
                </div>
                <div className="compare-value">
                  <strong>{formatted(p)}</strong>
                  <small>{secondary(p.headline.multiple, p.headline.cost)}</small>
                </div>
              </header>
              <div className="compare-bar" aria-hidden="true">
                <span
                  style={{
                    width: width(value(p)),
                    background: color(p.headline.rows[0].point),
                  }}
                />
              </div>
              <div className="compare-models">
                {p.varies ? (
                  <p className="compare-varies">
                    {t(
                      `Value differs by model on this plan — ${multiple(p.headline.multiple, state.lang)} is only the most common of ${p.exceptions.length + 1} distinct values. Range ${multiple(p.worst.point.api_cost_multiple, state.lang)} to ${multiple(p.best.point.api_cost_multiple, state.lang)} (${p.best.point.model_display}).`,
                      `此套餐各模型价值差异很大——${multiple(p.headline.multiple, state.lang)} 只是 ${p.exceptions.length + 1} 个不同数值中最常见的一个。区间 ${multiple(p.worst.point.api_cost_multiple, state.lang)} 至 ${multiple(p.best.point.api_cost_multiple, state.lang)}（${p.best.point.model_display}）。`,
                    )}
                  </p>
                ) : (
                  <div className="compare-chips">
                    <span className="compare-chips-label">
                      {t("Shared by", "共享此价值")}
                    </span>
                    {p.headline.rows.map(chip)}
                  </div>
                )}
              </div>
              {p.exceptions.slice(0, EXCEPTION_LIMIT).map((g) => (
                <button
                  className="exception-row"
                  key={g.multiple}
                  onClick={() => onSelect(g.rows)}
                >
                  <span className="exception-head">
                    <span className="exception-label">
                      {t("exception", "例外")}
                    </span>
                    <span className="exception-models">{g.rows.map(chip)}</span>
                    <span className="exception-value">
                      <strong>{groupLabel(g)}</strong>
                      <small>{secondary(g.multiple, g.cost)}</small>
                    </span>
                    <ArrowRight size={14} />
                  </span>
                  {/* Same track and origin as the headline bar above, or the two
                      cannot be compared by eye — which is the point of the view. */}
                  <span className="exception-bar" aria-hidden="true">
                    <span
                      style={{
                        width: width(groupValue(g)),
                        background: color(g.rows[0].point),
                      }}
                    />
                  </span>
                </button>
              ))}
              {p.exceptions.length > EXCEPTION_LIMIT && (
                <p className="more-exceptions">
                  {t(
                    `+${p.exceptions.length - EXCEPTION_LIMIT} more distinct values, down to ${multiple(p.worst.point.api_cost_multiple, state.lang)} (${p.worst.point.model_display}). Open the full data table for every model.`,
                    `另有 ${p.exceptions.length - EXCEPTION_LIMIT} 个不同数值，最低 ${multiple(p.worst.point.api_cost_multiple, state.lang)}（${p.worst.point.model_display}）。完整数据表可查看每个模型。`,
                  )}
                </p>
              )}
            </article>
          ))
        ) : (
          <div className="empty">
            <h3>{t("No plans selected", "未选择套餐")}</h3>
            <button onClick={() => patch({ plans: [] })}>
              {t("Show all plans", "显示全部套餐")}
            </button>
          </div>
        )}
      </div>
      <p className="ranking-status">
        {shown.length} {t("plans compared", "个套餐参与对比")} ·{" "}
        {t(
          "‡ value inherited from a sibling model · * rate is not a first-party card · cache writes not modeled, so every figure is a floor",
          "‡ 数值沿用同套餐基准模型 · * 标价非厂商一手价目表 · 不含缓存写入费，故均为下限",
        )}
      </p>
    </section>
  );
}
