import type { State, SiteData, Row, Point, Group, FilterKey } from "./types";
import feeBandDefinitions from "../../config/allowance-fee-bands.json";
export const feeBands = feeBandDefinitions;
export function matchesFeeBand(fee: number | null, id: string): boolean {
  if (id === "all") return true;
  const band = feeBands.find((b) => b.id === id);
  return (
    fee !== null &&
    !!band &&
    (band.minInclusive ? fee >= band.min : fee > band.min) &&
    (band.maxInclusive ? fee <= band.max : fee < band.max)
  );
}
export const filterKeys: FilterKey[] = [
  "vendors",
  "channels",
  "plans",
  "billing",
  "confidence",
  "harness",
  "effort",
  "modes",
];
export const colors: Record<string, string> = {
  OpenAI: "#00A86B",
  Anthropic: "#F07826",
  xAI: "#B65CFF",
  Cursor: "#FFB81C",
  Kimi: "#2FA8FF",
  Zhipu: "#1E1E1E",
  MiniMax: "#D23A7D",
  Alibaba: "#FF4545",
  OpenCode: "#00B9A4",
  DeepSeek: "#1F75FE",
  Google: "#82BE2C",
  "Command Code": "#64748B",
  Ollama: "#A0785C",
  Xiaomi: "#FFA000",
  Tencent: "#26C6DA",
  StepFun: "#00F4E5",
  Devin: "#7C3AED",
};
export const defaultState = (): State => ({
  feeBand: "all",
  lang: "en",
  view: "pareto",
  board: "arena_code",
  selected: null,
  vendors: [],
  channels: [],
  plans: [],
  billing: [],
  confidence: [],
  harness: [],
  effort: [],
  modes: [],
  configuration: "summary",
  frontier: true,
  labels: "frontier",
  query: "",
  sort: "price",
  direction: "asc",
});
export const color = (p: Point) => colors[p.channel] || "#00A8A8";
const matches = (items: string[], value: string | null) =>
  !items.length || items.includes(value ?? "unknown");
export function options(data: SiteData): Record<FilterKey, string[]> {
  const unique = (values: (string | null)[]) =>
    [...new Set(values.map((v) => v ?? "unknown"))].sort();
  return {
    vendors: unique(data.points.map((p) => p.vendor)),
    channels: unique(data.points.map((p) => p.channel)),
    plans: unique(data.points.map((p) => p.plan)),
    billing: unique(data.points.map((p) => p.billing)),
    confidence: unique(data.points.map((p) => p.confidence)),
    harness: unique(data.mappings.map((m) => m.agent_harness)),
    effort: unique(data.mappings.map((m) => m.reasoning_effort)),
    modes: unique(data.mappings.map((m) => m.service_mode)),
  };
}
export function visiblePoints(data: SiteData, s: State): Point[] {
  const chosen = s.selected === null ? null : new Set(s.selected);
  return data.points.filter(
    (p) =>
      (!chosen || chosen.has(p.id)) &&
      matches(s.vendors, p.vendor) &&
      matches(s.channels, p.channel) &&
      matches(s.plans, p.plan) &&
      matches(s.billing, p.billing) &&
      matches(s.confidence, p.confidence) &&
      (s.view !== "allowance" ||
        (p.billing !== "metered" &&
          p.monthly_yi !== null &&
          matchesFeeBand(p.price_usd, s.feeBand))) &&
      // A row with no published API rate is absent from the value view rather
      // than plotted at zero, which would read as "worth nothing".
      (s.view !== "multiple" || p.api_cost_multiple !== null),
  );
}
export function rowsFor(data: SiteData, s: State): Row[] {
  const byPoint = new Map<string, typeof data.mappings>();
  for (const m of data.mappings)
    if (
      m.board === s.board &&
      matches(s.harness, m.agent_harness) &&
      matches(s.effort, m.reasoning_effort) &&
      matches(s.modes, m.service_mode)
    )
      byPoint.set(m.point_id, [...(byPoint.get(m.point_id) || []), m]);
  return visiblePoints(data, s).flatMap((p) => {
    let mappings = byPoint.get(p.id) || [];
    if (s.configuration === "summary" && mappings.length)
      mappings = [mappings.reduce((a, b) => (a.score >= b.score ? a : b))];
    if (s.view !== "pareto") {
      const m = mappings.length
        ? mappings.reduce((a, b) => (a.score >= b.score ? a : b))
        : null;
      return [{ key: p.id, point: p, mapping: m, score: m?.score ?? null }];
    }
    return mappings.length
      ? mappings.map((m) => ({
          key: `${p.id}|${m.configuration_id}`,
          point: p,
          mapping: m,
          score: m.score,
        }))
      : [{ key: p.id, point: p, mapping: null, score: null }];
  });
}
export function tableRows(rows: Row[], s: State): Row[] {
  const q = s.query.toLocaleLowerCase().trim();
  const value = (r: Row): number | string | null =>
    s.sort === "model"
      ? r.point.model_display
      : s.sort === "plan"
        ? r.point.plan
        : s.sort === "score"
          ? r.score
          : s.sort === "allowance"
            ? r.point.monthly_yi
            : s.sort === "fee"
              ? r.point.price_usd
              : s.sort === "apiCost"
                ? r.point.api_cost_usd_month
                : s.sort === "multiple"
                  ? r.point.api_cost_multiple
                  : r.point.real_usd_per_mtok;
  return rows
    .filter(
      (r) =>
        !q ||
        `${r.point.label} ${displayPlan(r.point.plan, s.lang)} ${r.point.channel} ${r.mapping?.variant ?? ""}`
          .toLocaleLowerCase()
          .includes(q),
    )
    .sort((a, b) => {
      const av = value(a),
        bv = value(b);
      if (av === null) return bv === null ? 0 : 1;
      if (bv === null) return -1;
      const cmp =
        typeof av === "string"
          ? av.localeCompare(String(bv))
          : Number(av) - Number(bv);
      return (
        (s.direction === "asc" ? 1 : -1) * cmp || a.key.localeCompare(b.key)
      );
    });
}
/** Unmetered ($0) groups are drawn this far to the right of the cheapest priced group. */
export const ZERO_SLOT_RATIO = 3.5;
export const isUnmetered = (p: Point) =>
  !!p.unmetered && p.real_usd_per_mtok === 0;
export function zeroSlot(prices: number[]): number {
  const priced = prices.filter((v) => v > 0);
  return (priced.length ? Math.min(...priced) : 0.001) / ZERO_SLOT_RATIO;
}
export function groups(rows: Row[]): Group[] {
  const map = new Map<string, Group>();
  for (const r of rows)
    if (
      r.score !== null &&
      Number.isFinite(r.score) &&
      (r.point.real_usd_per_mtok > 0 || isUnmetered(r.point))
    ) {
      const key = `${r.point.real_usd_per_mtok}|${r.score}`;
      const g = map.get(key);
      if (g) g.rows.push(r);
      else
        map.set(key, {
          key,
          price: r.point.real_usd_per_mtok,
          plotPrice: r.point.real_usd_per_mtok,
          score: r.score,
          rows: [r],
        });
    }
  const out = [...map.values()];
  const slot = zeroSlot(out.map((g) => g.price));
  for (const g of out) if (g.price === 0) g.plotPrice = slot;
  return out;
}
export function pareto(gs: Group[]): Group[] {
  let best = -Infinity;
  const result: Group[] = [];
  for (const g of [...gs].sort(
    (a, b) => a.price - b.price || b.score - a.score,
  ))
    if (g.score > best) {
      result.push(g);
      best = g.score;
    }
  return result;
}
export function frontierPath(
  front: Group[],
  minPrice: number,
  maxPrice: number,
) {
  if (!front.length) return { x: [], y: [] };
  return {
    x: [minPrice, ...front.map((g) => g.plotPrice), maxPrice],
    y: [
      front[0].score,
      ...front.map((g) => g.score),
      front[front.length - 1].score,
    ],
  };
}
export function serialize(s: State): string {
  return (
    "#" + new URLSearchParams({ s: JSON.stringify({ v: 1, ...s }) }).toString()
  );
}
export function restore(
  hash: string,
  data: SiteData,
  storedLang: string | null = null,
): { state: State; warning: boolean } {
  const state = defaultState();
  if (storedLang === "zh") state.lang = "zh";
  if (!hash || hash === "#") return { state, warning: false };
  try {
    const raw = JSON.parse(
      new URLSearchParams(hash.slice(1)).get("s") || "null",
    );
    if (!raw || raw.v !== 1) return { state, warning: true };
    let warning = false;
    const enums = {
      feeBand: ["all", ...feeBands.map((b) => b.id)],
      lang: ["en", "zh"],
      view: ["pareto", "price", "allowance", "multiple", "compare", "method"],
      configuration: ["all", "summary"],
      labels: ["frontier", "all", "none"],
      sort: ["price", "model", "plan", "score", "allowance", "fee", "apiCost", "multiple"],
      direction: ["asc", "desc"],
    };
    for (const [key, values] of Object.entries(enums)) {
      if (values.includes(raw[key])) Object.assign(state, { [key]: raw[key] });
      else if (raw[key] !== undefined) warning = true;
    }
    if (typeof raw.board === "string" && Object.hasOwn(data.boards, raw.board))
      state.board = raw.board;
    else if (raw.board !== undefined) warning = true;
    if (typeof raw.frontier === "boolean") state.frontier = raw.frontier;
    if (typeof raw.query === "string") state.query = raw.query;
    if (Array.isArray(raw.selected)) {
      const ids = new Set(data.points.map((p) => p.id));
      const selected: string[] = raw.selected.filter(
        (id: unknown) => typeof id === "string" && ids.has(id),
      );
      state.selected = selected;
      if (selected.length !== raw.selected.length) warning = true;
    } else if (raw.selected !== null && raw.selected !== undefined)
      warning = true;
    const opts = options(data);
    for (const k of filterKeys) {
      if (Array.isArray(raw[k])) {
        state[k] = raw[k].filter(
          (v: unknown) => typeof v === "string" && opts[k].includes(v),
        );
        if (state[k].length !== raw[k].length) warning = true;
      } else if (raw[k] !== undefined) warning = true;
    }
    return { state, warning };
  } catch {
    return { state, warning: true };
  }
}
export const number = (n: number | null, lang = "en", digits = 3) =>
  n === null
    ? "—"
    : new Intl.NumberFormat(lang === "zh" ? "zh-CN" : "en-US", {
        maximumFractionDigits: digits,
      }).format(n);
export const price = (n: number | null) =>
  n === null
    ? "—"
    : n === 0
      ? "≈$0"
      : "$" +
      new Intl.NumberFormat("en-US", { maximumSignificantDigits: 4 }).format(n);
export const allowance = (p: Point, lang: string) =>
  p.monthly_yi === null
    ? "—"
    : number(lang === "zh" ? p.monthly_yi : p.monthly_yi / 10, lang, 3) +
      (lang === "zh" ? " 亿" : " B");
/** Whole dollars: the API cost of a month's allowance runs from tens to five figures. */
export const money = (n: number | null, lang = "en") =>
  n === null
    ? "—"
    : "$" +
      new Intl.NumberFormat(lang === "zh" ? "zh-CN" : "en-US", {
        maximumFractionDigits: n < 10 ? 2 : 0,
      }).format(n);
/** "×21" reads as "this allowance is worth 21 monthly fees at list price".
 *  Keeps a decimal up to 100 so rows that rank differently do not print the same
 *  number — ×54.2 and ×53.6 must stay distinguishable in a ranking sorted by it —
 *  and two decimals below 2, where rounding ×1.04 to "×1" would read as exactly
 *  break-even when the plan is in fact slightly ahead. */
export const multiple = (n: number | null, lang = "en") =>
  n === null ? "" : "×" + number(n, lang, n < 2 ? 2 : n < 100 ? 1 : 0);
export const safeUrl = (url: string) =>
  /^https?:\/\//i.test(url) || url.startsWith("/data/") ? url : undefined;
export const manufacturer = (vendor: string) =>
  vendor === "Muse" ? "Meta" : vendor === "Cognition" ? "Devin" : vendor;
/** Short promo/unmetered qualifier for a $0 point, or "" for priced points. */
export function unmeteredNote(p: Point, lang: string): string {
  if (!isUnmetered(p)) return "";
  const until = p.promo_until;
  if (!until) return lang === "zh" ? "不计额度" : "unmetered";
  return lang === "zh"
    ? `促销至 ${until}，不计额度`
    : `promo until ${until}, unmetered`;
}
/** Short badge for a vendor self-reported score. */
export function selfReportTag(lang: string): string {
  return lang === "zh" ? "厂商自报" : "self-reported";
}
/** Localize the bracketed provenance tags baked into variant names. */
export function variantLabel(variant: string, lang: string): string {
  if (lang !== "zh") return variant;
  return variant
    .replaceAll("[vendor self-report]", "[厂商自报]")
    .replaceAll("[AA estimate]", "[AA 估计值]");
}
export const isThirdParty = (p: Point) => p.channel !== manufacturer(p.vendor);
export const accessLine = (p: Point) =>
  isThirdParty(p)
    ? `${p.channel} | ${manufacturer(p.vendor)}`
    : p.channel;
export function displayPlan(plan: string, lang: string): string {
  if (plan.startsWith("GLM "))
    plan = plan.replaceAll("老客", "v2").replaceAll("新客", "v3");
  if (lang === "zh") return plan;
  const words: Record<string, string> = {
    "Kimi 会员 ": "Kimi CN CNY ",
    阿里云百炼: "Alibaba Cloud CN",
    新客: "New",
    老客: "Existing",
    闲时: "Off-peak",
    中间值: "Midpoint",
    忙时: "Peak",
    "促销至 ": "promo until ",
  };
  return Object.entries(words).reduce(
    (s, [from, to]) => s.replaceAll(from, to),
    plan,
  );
}
export function csv(rows: Row[], lang: string): string {
  const headings =
    lang === "zh"
      ? [
          "数据点ID",
          "模型",
          "渠道",
          "套餐",
          "计费",
          "月费 USD",
          "原币价格",
          "币种",
          "月 token",
          "真实单价 USD/MTok",
          "API标价混合单价 USD/MTok",
          "API标价成本 USD/月",
          "成本倍数 ×月费",
          "标价来源分级",
          "标价置信度",
          "成本沿用同套餐基准",
          "标价来源",
          "额度置信度",
          "评测配置",
          "分数",
          "AA 估计值",
          "厂商自报",
          "Harness",
          "Effort",
          "分数来源",
          "采用依据",
        ]
      : [
          "Point ID",
          "Model",
          "Channel",
          "Plan",
          "Billing",
          "Monthly fee USD",
          "Original price",
          "Currency",
          "Monthly tokens",
          "Real price USD/MTok",
          "API list blended USD/MTok",
          "API cost USD/month",
          "API cost multiple of fee",
          "API price tier",
          "API price confidence",
          "API cost inherited from sibling",
          "API price source",
          "Quota confidence",
          "Benchmark configuration",
          "Score",
          "AA estimated score",
          "Vendor self-reported",
          "Harness",
          "Effort",
          "Score source",
          "Adoption source",
        ];
  const escape = (v: unknown) => {
    let t = String(v ?? "");
    if (/^[=+\-@\t\r]/.test(t)) t = "'" + t;
    return '"' + t.replaceAll('"', '""') + '"';
  };
  return (
    "\uFEFF" +
    [
      headings,
      ...rows.map((r) => [
        r.point.id,
        r.point.model_display,
        r.point.channel,
        displayPlan(r.point.plan, lang),
        r.point.billing,
        r.point.billing === "metered" ? null : r.point.price_usd,
        r.point.original_price,
        r.point.currency,
        r.point.monthly_tokens,
        r.point.real_usd_per_mtok,
        r.point.list_blended_usd_per_mtok,
        r.point.api_cost_usd_month,
        r.point.api_cost_multiple,
        r.point.api_price_tier,
        r.point.api_price_confidence,
        r.point.api_cost_inherited,
        r.point.api_price_source,
        r.point.confidence,
        r.mapping?.variant,
        r.score,
        r.mapping?.score_is_estimated,
        r.mapping?.score_is_self_reported,
        r.mapping?.agent_harness,
        r.mapping?.reasoning_effort,
        r.mapping?.source,
        r.point.source,
      ]),
    ]
      .map((row) => row.map(escape).join(","))
      .join("\r\n")
  );
}

/** One subscription plan, with the value its models share and the models that differ.
 *
 *  Allowances inside a plan are alternatives, never additive, so a plan has no single
 *  total. What it does have is a value most of its models share — because the adopted
 *  allowances were derived from one another by list-price ratio — plus the models whose
 *  own evidence puts them somewhere else. Those are the exceptions.
 */
export interface ValueGroup {
  multiple: number;
  cost: number;
  rows: Row[];
  /** Every row here inherited its allowance from a sibling model by a price ratio. */
  inherited: boolean;
}
export interface PlanComparison {
  key: string;
  plan: string;
  channel: string;
  fee: number | null;
  currency: string;
  originalPrice: number | null;
  headline: ValueGroup;
  exceptions: ValueGroup[];
  best: Row;
  worst: Row;
  modelCount: number;
  /** The headline covers fewer than half the plan's priced models, so it is the most
   *  common value rather than a representative one. Wrapper plans that resell dozens of
   *  models land here, and their spread must be read instead of the headline. */
  varies: boolean;
}
export function planComparisons(rows: Row[]): PlanComparison[] {
  const byPlan = new Map<string, Row[]>();
  for (const r of rows) {
    if (r.point.api_cost_multiple === null || r.point.billing === "metered") continue;
    const seen = byPlan.get(r.point.plan_id);
    // One row per served model; benchmark configurations must not inflate a plan.
    if (!seen) byPlan.set(r.point.plan_id, [r]);
    else if (!seen.some((s) => s.point.id === r.point.id)) seen.push(r);
  }
  const comparisons: PlanComparison[] = [];
  for (const [key, planRows] of byPlan) {
    const groups = new Map<number, Row[]>();
    for (const r of planRows) {
      const m = r.point.api_cost_multiple!;
      groups.set(m, [...(groups.get(m) || []), r]);
    }
    const asGroup = ([multiple, rs]: [number, Row[]]): ValueGroup => ({
      multiple,
      cost: rs[0].point.api_cost_usd_month!,
      rows: [...rs].sort((a, b) =>
        a.point.model_display.localeCompare(b.point.model_display),
      ),
      inherited: rs.every((r) => r.point.api_cost_inherited),
    });
    // The headline is the value the most models share; ties go to the higher value.
    const ranked = [...groups.entries()].sort(
      (a, b) => b[1].length - a[1].length || b[0] - a[0],
    );
    const headline = asGroup(ranked[0]);
    const exceptions = ranked
      .slice(1)
      .map(asGroup)
      .sort((a, b) => b.multiple - a.multiple);
    const ordered = [...planRows].sort(
      (a, b) => b.point.api_cost_multiple! - a.point.api_cost_multiple!,
    );
    const first = planRows[0].point;
    comparisons.push({
      key,
      plan: first.plan,
      channel: first.channel,
      fee: first.price_usd,
      currency: first.currency,
      originalPrice: first.original_price,
      headline,
      exceptions,
      best: ordered[0],
      worst: ordered[ordered.length - 1],
      modelCount: planRows.length,
      varies: headline.rows.length * 2 < planRows.length,
    });
  }
  return comparisons;
}
/** Sort keys the comparison dashboard offers: the fee-relative value, the absolute
 *  dollar value of the allowance, or the fee itself. */
export function sortComparisons(
  plans: PlanComparison[],
  by: "value" | "apiCost" | "fee",
): PlanComparison[] {
  const value = (p: PlanComparison) =>
    by === "fee" ? (p.fee ?? 0) : by === "apiCost" ? p.headline.cost : p.headline.multiple;
  return [...plans].sort(
    (a, b) => value(b) - value(a) || a.plan.localeCompare(b.plan),
  );
}
