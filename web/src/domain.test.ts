import test from "node:test";
import { wheelRange } from "./wheelZoom";
import { unpackData } from "./loadData";
import assert from "node:assert/strict";

test("Wheel zoom preserves cursor anchor and reversed logarithmic axis direction", () => {
  for (const range of [[1, -3], [1400, 1700]]) {
    const fraction = 0.27;
    const anchor = range[0] + (range[1] - range[0]) * fraction;
    const zoomed = wheelRange(range, fraction, -100);
    assert.ok(Math.abs(zoomed[0] + (zoomed[1] - zoomed[0]) * fraction - anchor) < 1e-9);
    assert.equal(Math.sign(zoomed[1] - zoomed[0]), Math.sign(range[1] - range[0]));
    assert.ok(Math.abs(zoomed[1] - zoomed[0]) < Math.abs(range[1] - range[0]));
    const restored = wheelRange(zoomed, fraction, 100);
    restored.forEach((n, i) => assert.ok(Math.abs(n - range[i]) < 1e-9));
  }
});
import { readFileSync } from "node:fs";
import { parse } from "csv-parse/sync";
import {
  matchesFeeBand,
  feeBands,
  allowance,
  csv,
  defaultState,
  accessLine,
  displayPlan,
  isThirdParty,
  manufacturer,
  frontierPath,
  groups,
  money,
  multiple,
  pareto,
  planComparisons,
  sortComparisons,
  restore,
  rowsFor,
  serialize,
  tableRows,
  visiblePoints,
} from "./domain";
import {
  FRONTIER_RADIUS,
  placeTextLabels,
  placementRect,
} from "./chartLabels";
import type { Group, Point, Row, SiteData } from "./types";
import type { PlanComparison } from "./domain";
const data: SiteData = unpackData(JSON.parse(
  readFileSync(new URL("../public/data/site.json", import.meta.url), "utf8"),
));

test("Packed website mappings restore every original field without data loss", () => {
  const raw = JSON.parse(readFileSync(new URL("../../derived/benchmark-points.json", import.meta.url), "utf8"));
  assert.deepEqual(data.mappings, raw);
});
test("Monthly fee bands have exact non-overlapping boundaries and preserve all eligible allowances", () => {
  for (const [fee, expected] of [
    [0, "0-30"],
    [30, "0-30"],
    [30.01, "30-100"],
    [99.99, "30-100"],
    [100, "30-100"],
    [300, "100-300"],
    [300.01, undefined],
  ] as const) {
    assert.deepEqual(
      feeBands.filter((b) => matchesFeeBand(fee, b.id)).map((b) => b.id),
      expected ? [expected] : [],
    );
  }
  assert.equal(matchesFeeBand(null, "0-30"), false);
  const s = { ...defaultState(), view: "allowance" as const };
  const all = visiblePoints(data, s);
  const split = feeBands.flatMap((b) =>
    visiblePoints(data, { ...s, feeBand: b.id }),
  );
  assert.equal(new Set(split.map((p) => p.id)).size, split.length);
  assert.deepEqual(
    new Set(split.map((p) => p.id)),
    new Set(
      all
        .filter(
          (p) => p.price_usd !== null && p.price_usd >= 0 && p.price_usd <= 300,
        )
        .map((p) => p.id),
    ),
  );
  const filtered = { ...s, feeBand: "100-300" };
  assert.equal(restore(serialize(filtered), data).state.feeBand, "100-300");
  assert.equal(
    visiblePoints(data, { ...filtered, view: "price" }).length,
    data.points.length,
  );
});
const adopted = parse(
  readFileSync(new URL("../../data/adopted.csv", import.meta.url), "utf8"),
  { columns: true, skip_empty_lines: true, bom: true },
) as Record<string, string>[];
test("All source point values and stable IDs survive the adapter, including null API fees", () => {
  assert.equal(data.points.length, adopted.length);
  assert.equal(new Set(data.points.map((p) => p.id)).size, adopted.length);
  for (const a of adopted) {
    const p = data.points.find(
      (p) => p.id === `${a.plan_id}::${a.served_model}`,
    )!;
    assert.ok(p);
    assert.equal(p.real_usd_per_mtok, Number(a.real_usd_per_mtok));
    assert.equal(p.price_usd, a.price_usd === "" ? null : Number(a.price_usd));
    assert.equal(
      p.monthly_tokens,
      a.monthly_tokens === "" ? null : Number(a.monthly_tokens),
    );
  }
});
test("Default selection includes every adopted point, including unscored models", () => {
  const rows = rowsFor(data, defaultState());
  assert.equal(new Set(rows.map((r) => r.point.id)).size, data.points.length);
  assert.ok(rows.some((r) => r.score === null));
});
test("All four boards preserve all references; optional summary takes only matching maximum", () => {
  for (const board of Object.keys(data.boards)) {
    const s = { ...defaultState(), board };
    const rows = rowsFor(data, s);
    assert.equal(
      rows.filter((r) => r.mapping).length,
      data.mappings.filter((m) => m.board === board).length,
    );
    const summary = rowsFor(data, { ...s, configuration: "summary" });
    assert.equal(summary.length, data.points.length);
    for (const r of summary) {
      const originals = rows.filter(
        (rr) => rr.point.id === r.point.id && rr.score !== null,
      );
      assert.equal(
        r.score,
        originals.length ? Math.max(...originals.map((rr) => rr.score!)) : null,
      );
    }
  }
});
test("Channels and model developers are separate, and filter dimensions intersect", () => {
  const s = {
    ...defaultState(),
    vendors: ["DeepSeek"],
    channels: ["OpenCode"],
    billing: ["subscription"],
  };
  const ps = visiblePoints(data, s);
  assert.ok(ps.length);
  assert.ok(
    ps.every((p) => p.vendor === "DeepSeek" && p.channel === "OpenCode"),
  );
  assert.equal(
    visiblePoints(data, { ...s, confidence: ["not-present"] }).length,
    0,
  );
});
test("Empty model selection stays empty; null selection means all; individual selection is exact", () => {
  assert.equal(rowsFor(data, { ...defaultState(), selected: [] }).length, 0);
  const id = data.points[0].id;
  assert.deepEqual(
    [
      ...new Set(
        rowsFor(data, { ...defaultState(), selected: [id] }).map(
          (r) => r.point.id,
        ),
      ),
    ],
    [id],
  );
});
test("Monthly allowance excludes APIs, preserves unscored subscriptions and does not duplicate configurations", () => {
  const rows = rowsFor(data, { ...defaultState(), view: "allowance" });
  assert.equal(
    rows.length,
    data.points.filter((p) => p.billing !== "metered" && p.monthly_yi !== null)
      .length,
  );
  assert.ok(rows.every((r) => r.point.billing !== "metered"));
  assert.equal(new Set(rows.map((r) => r.point.id)).size, rows.length);
});
test("Harness/effort/mode filters constrain scores without silently losing unscored plans", () => {
  const rows = rowsFor(data, {
    ...defaultState(),
    harness: ["Codex"],
    effort: ["xhigh"],
  });
  assert.equal(new Set(rows.map((r) => r.point.id)).size, data.points.length);
  assert.ok(rows.some((r) => r.mapping));
  assert.ok(
    rows
      .filter((r) => r.mapping)
      .every(
        (r) =>
          r.mapping!.agent_harness === "Codex" &&
          r.mapping!.reasoning_effort === "xhigh",
      ),
  );
});
const point = (id: string, price: number): Point => ({
  ...data.points[0],
  id,
  real_usd_per_mtok: price,
});
const row = (id: string, price: number, score: number | null): Row => ({
  key: id,
  point: point(id, price),
  score,
  mapping: null,
});
test("Strict dominance retains both identical plans and drops equal-price lower scores/equal-score dearer plans", () => {
  const rows = [
    row("a", 1, 10),
    row("b", 1, 10),
    row("c", 1, 9),
    row("d", 2, 10),
    row("e", 3, 12),
    row("f", 0.5, null),
  ];
  const gs = groups(rows);
  assert.equal(gs.length, 4);
  const front = pareto(gs);
  assert.deepEqual(
    front.flatMap((g) => g.rows.map((r) => r.key)),
    ["a", "b", "e"],
  );
});
test("Four-board frontiers agree with independent pairwise dominance", () => {
  for (const board of Object.keys(data.boards)) {
    const gs = groups(rowsFor(data, { ...defaultState(), board }));
    const expected = gs.filter(
      (g) =>
        !gs.some(
          (other) =>
            other.price <= g.price &&
            other.score >= g.score &&
            (other.price < g.price || other.score > g.score),
        ),
    );
    assert.deepEqual(
      pareto(gs)
        .map((g) => g.key)
        .sort(),
      expected.map((g) => g.key).sort(),
    );
  }
});
test("Frontier endpoints extend cheapest score right and highest score left on reversed log axis", () => {
  const f = pareto(groups([row("cheap", 1, 10), row("best", 3, 12)]));
  assert.deepEqual(frontierPath(f, 0.1, 10), {
    x: [0.1, 1, 3, 10],
    y: [10, 10, 12, 12],
  });
  assert.deepEqual(frontierPath([], 1, 2), { x: [], y: [] });
});
test("Share links round-trip language, board, exact empty selection and all view settings", () => {
  const s = {
    ...defaultState(),
    lang: "zh" as const,
    view: "allowance" as const,
    selected: [],
    board: "aa_coding_agent_index",
    channels: ["Cursor"],
    labels: "none" as const,
    frontier: false,
    query: "Luna / 中文",
    direction: "desc" as const,
  };
  const restored = restore(serialize(s), data);
  assert.deepEqual(restored.state, s);
  assert.equal(restored.warning, false);
});
test("Invalid saved values are ignored with notice; explicit language overrides local preference", () => {
  const s = {
    ...defaultState(),
    selected: [data.points[0].id, "removed-id"],
    channels: ["removed-channel"],
    board: "__proto__",
  };
  const result = restore(serialize(s), data, "zh");
  assert.equal(result.warning, true);
  assert.equal(result.state.lang, "en");
  assert.equal(result.state.board, "arena_code");
  assert.deepEqual(result.state.selected, [data.points[0].id]);
  assert.deepEqual(result.state.channels, []);
  assert.equal(restore("#s=%notjson", data).warning, true);
  assert.equal(restore("", data, "zh").state.lang, "zh");
});
test("Table search, numeric ordering and CSV reflect the entire selected table rather than a page", () => {
  const s = {
    ...defaultState(),
    query: "Luna",
    sort: "allowance",
    direction: "desc" as const,
  };
  const rs = tableRows(rowsFor(data, s), s);
  assert.ok(rs.length);
  assert.ok(rs.every((r) => r.point.label.includes("Luna")));
  assert.ok(rs[0].point.monthly_yi! >= rs.at(-1)!.point.monthly_yi!);
  const exported = parse(csv(rs, "en"), { bom: true, columns: true }) as Record<
    string,
    string
  >[];
  assert.equal(exported.length, rs.length);
  assert.equal(
    Number(exported[0]["Real price USD/MTok"]),
    rs[0].point.real_usd_per_mtok,
  );
});
test("Third-party access lines put the reseller before the model manufacturer", () => {
  const muse = data.points.find(
    (p) => p.vendor === "Muse" && p.channel === "OpenCode",
  )!;
  const glm = data.points.find(
    (p) => p.vendor === "Zhipu" && p.channel === "Zhipu",
  )!;
  assert.equal(manufacturer("Muse"), "Meta");
  assert.equal(isThirdParty(muse), true);
  assert.equal(accessLine(muse), "OpenCode | Meta");
  assert.equal(isThirdParty(glm), false);
  assert.equal(accessLine(glm), "Zhipu");
  const step = data.points.find(
    (p) => p.vendor === "StepFun" && p.channel === "Command Code",
  )!;
  assert.equal(step.model_display.includes("Step"), true);
  assert.equal(accessLine(step), "Command Code | StepFun");
});
test("Language conversion only changes display units and labels", () => {
  const p = { ...data.points[0], monthly_yi: 77.37 };
  assert.equal(allowance(p, "en"), "7.737 B");
  assert.equal(allowance(p, "zh"), "77.37 亿");
  assert.equal(
    displayPlan("GLM (老客 ¥149) 闲时", "en"),
    "GLM (v2 ¥149) Off-peak",
  );
});
test("Chart names never overlap each other and leave the plot rather than collide", () => {
  const box = { left: 60, top: 20, right: 660, bottom: 420, width: 600, height: 400 };
  const group = (id: string, name: string): Group => {
    const r = row(id, 0.01, 1500);
    r.point = { ...r.point, model_display: name };
    return { key: id, price: 0.01, score: 1500, rows: [r] };
  };
  const place = (
    spots: { x: number; y: number }[],
    names: string[],
    area = box,
  ) => {
    const gs = names.map((n, i) => group(`g${i}`, n));
    const markers = gs.map((g, i) => ({
      key: g.key,
      x: spots[i].x,
      y: spots[i].y,
      r: FRONTIER_RADIUS,
    }));
    const anchors = new Map(markers.map((m) => [m.key, m]));
    const placements = placeTextLabels(gs, anchors, markers, area, false);
    const rects = placements.map((p) => {
      const m = anchors.get(p.key)!;
      return placementRect(p, m.x, m.y);
    });
    return { placements, rects, markers };
  };
  const names = [
    "Claude Opus 5",
    "GPT 5.6 Luna",
    "GLM 5.3 Flash",
    "DeepSeek V4 Flash",
    "Kimi K3",
    "月之暗面 K2.7 标准",
  ];
  const spread = names.map((_, i) => ({ x: 120 + i * 95, y: 80 + (i % 3) * 90 }));
  const wide = place(spread, names);
  assert.equal(wide.placements.length, names.length);
  wide.rects.forEach((a, i) => {
    assert.ok(a.left >= box.left && a.right <= box.right, `${i} inside x`);
    assert.ok(a.top >= box.top && a.bottom <= box.bottom, `${i} inside y`);
    wide.rects.slice(i + 1).forEach((b) => {
      const overlap =
        a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
      assert.ok(!overlap, "names must not overlap");
    });
    // The name stays beside its own marker instead of floating away.
    const m = wide.markers[i];
    assert.ok(
      Math.hypot(
        Math.min(Math.abs(a.left - m.x), Math.abs(a.right - m.x)),
        Math.min(Math.abs(a.top - m.y), Math.abs(a.bottom - m.y)),
      ) <= FRONTIER_RADIUS + 60,
    );
  });
  // With no room left, names are dropped instead of stacked on each other.
  const tight = { left: 0, top: 0, right: 220, bottom: 90, width: 220, height: 90 };
  const crowded = place(
    names.map((_, i) => ({ x: 100 + (i % 2) * 10, y: 40 + i * 6 })),
    names,
    tight,
  );
  assert.ok(crowded.placements.length < names.length);
  crowded.rects.forEach((a, i) =>
    crowded.rects.slice(i + 1).forEach((b) => {
      const overlap =
        a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
      assert.ok(!overlap, "crowded names must not overlap");
    }),
  );
});
test("Labels yield to ordinary points when every candidate slot is occupied", () => {
  const r = row("blocked", 0.01, 1500);
  r.point = { ...r.point, model_display: "Claude Opus 5" };
  const g: Group = { key: r.key, price: 0.01, score: 1500, rows: [r] };
  const anchor = { key: g.key, x: 120, y: 100, r: FRONTIER_RADIUS };
  const dots = [];
  for (let x = 6; x < 240; x += 12)
    for (let y = 6; y < 200; y += 12)
      dots.push({ key: `dot-${x}-${y}`, x, y, r: 6 });
  assert.deepEqual(placeTextLabels([g], new Map([[g.key, anchor]]), dots,
    { left: 0, top: 0, right: 240, bottom: 200, width: 240, height: 200 }, false), []);
});
test("CSV escapes formula-like text and embedded quotes without changing numeric source values", () => {
  const r = row("csv", 0.002, 20);
  r.point = { ...r.point, model_display: '=BAD("x")' };
  const parsed = parse(csv([r], "en"), { bom: true, columns: true }) as Record<
    string,
    string
  >[];
  assert.equal(parsed[0].Model, '\'=BAD("x")');
  assert.equal(parsed[0]["Real price USD/MTok"], "0.002");
});

test("API cost restates each allowance at list rates, stays blank when unpriced, and never contradicts the fee", () => {
  const mix = data.conventions.standardTokenMix;
  assert.ok(Math.abs(mix.cache + mix.input + mix.output - 1) < 1e-9);
  let priced = 0,
    blank = 0,
    inherited = 0;
  for (const p of data.points) {
    if (p.api_cost_usd_month === null) {
      // A missing rate must leave the cell empty rather than imply free tokens.
      blank++;
      assert.ok(p.list_blended_usd_per_mtok === null || p.monthly_tokens === null);
      assert.equal(p.api_cost_multiple, null);
      continue;
    }
    priced++;
    assert.equal(p.billing, "subscription");
    assert.ok(p.monthly_tokens !== null && p.list_blended_usd_per_mtok !== null);
    const expected = (p.monthly_tokens! / 1e6) * p.list_blended_usd_per_mtok!;
    assert.ok(Math.abs(p.api_cost_usd_month - expected) <= 0.01 + expected * 1e-6);
    // The multiple must be the same claim as the cost, not an independent number.
    // Tolerances are the published rounding: cost to cents, multiple to 2dp, d to 4dp.
    assert.ok(p.price_usd);
    assert.ok(
      Math.abs(p.api_cost_multiple! - p.api_cost_usd_month / p.price_usd!) <=
        0.005 + 0.001 * p.api_cost_multiple!,
    );
    // d is real price / list price, so it is the reciprocal of the multiple.
    if (p.d)
      assert.ok(
        Math.abs(p.api_cost_multiple! - 1 / p.d) <= 0.01 + 0.01 * p.api_cost_multiple!,
      );
    if (p.api_cost_inherited) inherited++;
    assert.ok(["official", "official_indirect", "third_party"].includes(p.api_price_tier!));
    assert.ok(["high", "medium", "low"].includes(p.api_price_confidence!));
  }
  assert.ok(priced > 150 && blank > 0);
  // Sibling-derived rows exist and must be flagged, or readers double-count one measurement.
  assert.ok(inherited > 0);
  const sonnet = data.points.find((p) => p.id === "claude_max_20x::claude-sonnet-5")!;
  const opus = data.points.find((p) => p.id === "claude_max_20x::claude-opus-5")!;
  assert.equal(sonnet.api_cost_inherited, true);
  assert.equal(opus.api_cost_inherited, false);
  assert.ok(Math.abs(sonnet.api_cost_usd_month! - opus.api_cost_usd_month!) < 1);
});

test("API cost is sortable, exported and formatted without inventing precision", () => {
  // The price view yields exactly one table row per point, as the data table does.
  const s = {
    ...defaultState(),
    view: "price" as const,
    sort: "apiCost",
    direction: "desc" as const,
  };
  const rs = tableRows(rowsFor(data, s), s);
  const costs = rs.map((r) => r.point.api_cost_usd_month);
  const present = costs.filter((c) => c !== null) as number[];
  assert.deepEqual(present, [...present].sort((a, b) => b - a));
  // Unpriced rows sort last instead of being dropped from the table.
  assert.equal(costs.slice(present.length).every((c) => c === null), true);
  assert.equal(rs.length, data.points.length);
  assert.deepEqual(restore(serialize(s), data).state.sort, "apiCost");

  const exported = parse(csv(rs, "en"), { bom: true, columns: true }) as Record<string, string>[];
  assert.equal(Number(exported[0]["API cost USD/month"]), rs[0].point.api_cost_usd_month);
  assert.equal(exported[0]["API price tier"], rs[0].point.api_price_tier);
  const unpriced = exported.at(-1)!;
  assert.equal(unpriced["API cost USD/month"], "");
  assert.equal(unpriced["API cost multiple of fee"], "");

  assert.equal(money(null), "—");
  assert.equal(money(10715.25), "$10,715");
  assert.equal(money(4.567), "$4.57");
  // Rows that rank differently must not print the same multiple.
  assert.equal(multiple(53.58), "×53.6");
  assert.equal(multiple(54.19), "×54.2");
  assert.equal(multiple(0.37), "×0.37");
  // Near break-even the second decimal is the whole story: ×1.04 is not ×1.
  assert.equal(multiple(1.04), "×1.04");
  assert.equal(multiple(1), "×1");
  assert.equal(multiple(null), "");
});

test("Subscription value view ranks by the fee multiple and excludes rows with no published rate", () => {
  const s = {
    ...defaultState(),
    view: "multiple" as const,
    sort: "multiple",
    direction: "desc" as const,
  };
  const shown = visiblePoints(data, s);
  // Every row on this view must have a multiple; unpriced rows are absent, not zeroed.
  assert.ok(shown.length);
  assert.ok(shown.every((p) => p.api_cost_multiple !== null));
  assert.equal(
    shown.length,
    data.points.filter((p) => p.api_cost_multiple !== null).length,
  );
  assert.ok(shown.length < data.points.length);
  // The fee band selector does not apply here, unlike the allowance view.
  assert.equal(visiblePoints(data, { ...s, feeBand: "100-300" }).length, shown.length);

  const rs = tableRows(rowsFor(data, s), s);
  const ranked = rs.map((r) => r.point.api_cost_multiple!);
  assert.deepEqual(ranked, [...ranked].sort((a, b) => b - a));
  assert.equal(rs.length, shown.length);
  // Sorting by the ratio is not the same ranking as sorting by the dollar amount.
  const byCost = tableRows(rowsFor(data, s), { ...s, sort: "apiCost" });
  assert.notDeepEqual(
    rs.map((r) => r.key),
    byCost.map((r) => r.key),
  );
  // At least one plan is worse than metered, so the break-even line is meaningful.
  assert.ok(ranked.at(-1)! < 1 && ranked[0] > 1);
  assert.deepEqual(restore(serialize(s), data).state.view, "multiple");
  assert.deepEqual(restore(serialize(s), data).state.sort, "multiple");
});

test("Plan comparison finds the value a plan's models share and separates the exceptions", () => {
  const rows = rowsFor(data, { ...defaultState(), view: "compare" });
  const plans = planComparisons(rows);
  // Every priced subscription plan appears exactly once; metered APIs have no plan value.
  const pricedPlans = new Set(
    data.points
      .filter((p) => p.api_cost_multiple !== null && p.billing !== "metered")
      .map((p) => p.plan_id),
  );
  assert.equal(plans.length, pricedPlans.size);
  assert.equal(new Set(plans.map((p) => p.key)).size, plans.length);

  for (const p of plans) {
    // Groups partition the plan's models: no model counted twice, none dropped.
    const all = [p.headline, ...p.exceptions].flatMap((g) => g.rows);
    assert.equal(all.length, p.modelCount);
    assert.equal(new Set(all.map((r) => r.point.id)).size, p.modelCount);
    // Each group is one distinct value, and the headline is the largest group.
    const sizes = [p.headline, ...p.exceptions].map((g) => g.rows.length);
    assert.equal(Math.max(...sizes), p.headline.rows.length);
    assert.equal(
      new Set([p.headline, ...p.exceptions].map((g) => g.multiple)).size,
      sizes.length,
    );
    for (const g of [p.headline, ...p.exceptions])
      assert.ok(g.rows.every((r) => r.point.api_cost_multiple === g.multiple));
    // The plan value is never a sum: it cannot exceed the best single model.
    assert.ok(p.headline.cost <= p.best.point.api_cost_usd_month!);
    assert.ok(
      p.best.point.api_cost_multiple! >= p.worst.point.api_cost_multiple!,
    );
    assert.equal(p.varies, p.headline.rows.length * 2 < p.modelCount);
  }

  // The case that motivated the view: same $200 fee, very different value.
  const at200 = plans.filter((p) => p.fee === 200);
  const claude = at200.find((p) => p.plan.startsWith("Claude Max 20x"))!;
  const chatgpt = at200.find((p) => p.plan === "ChatGPT Pro 20x")!;
  assert.ok(claude && chatgpt);
  assert.equal(claude.headline.rows.length, 3);
  assert.equal(claude.exceptions.length, 1);
  assert.deepEqual(
    claude.exceptions[0].rows.map((r) => r.point.model_display),
    ["Claude Fable 5"],
  );
  assert.ok(claude.headline.multiple > chatgpt.headline.multiple);
  assert.equal(claude.varies, false);
  // Wrapper plans reselling dozens of models must be flagged, not headlined.
  const wrapper = plans.find((p) => p.plan === "Command Code GOAT")!;
  assert.equal(wrapper.varies, true);
  assert.ok(wrapper.exceptions.length > 10);
});

test("Comparison ranking follows the chosen metric and stays stable on ties", () => {
  const plans = planComparisons(
    rowsFor(data, { ...defaultState(), view: "compare" }),
  );
  for (const [by, of] of [
    ["value", (p: PlanComparison) => p.headline.multiple],
    ["apiCost", (p: PlanComparison) => p.headline.cost],
    ["fee", (p: PlanComparison) => p.fee ?? 0],
  ] as const) {
    const ranked = sortComparisons(plans, by).map(of);
    assert.deepEqual(ranked, [...ranked].sort((a, b) => b - a));
  }
  // Ranking by value is not the same as ranking by absolute cost.
  assert.notDeepEqual(
    sortComparisons(plans, "value").map((p) => p.key),
    sortComparisons(plans, "apiCost").map((p) => p.key),
  );
  // Ties break on plan name, so the order never depends on input order.
  const shuffled = [...plans].reverse();
  assert.deepEqual(
    sortComparisons(shuffled, "value").map((p) => p.key),
    sortComparisons(plans, "value").map((p) => p.key),
  );
});

test("The site's plan grouping matches the published plan-value dataset exactly", () => {
  // compute.py writes derived/plan-value.json for the static chart; the site groups the
  // same points client-side so it can respond to filters. Two implementations of one
  // rule drift silently, so pin them together here.
  const published = JSON.parse(
    readFileSync(new URL("../../derived/plan-value.json", import.meta.url), "utf8"),
  ) as { plans: Record<string, unknown>[] };
  const computed = planComparisons(
    rowsFor(data, { ...defaultState(), view: "compare" }),
  );
  const byKey = new Map(computed.map((p) => [p.key, p]));
  assert.equal(published.plans.length, computed.length);
  for (const row of published.plans as any[]) {
    const mine = byKey.get(row.plan_id)!;
    assert.ok(mine, `missing plan ${row.plan_id}`);
    assert.equal(mine.plan, row.plan);
    assert.equal(mine.channel, row.channel);
    assert.equal(mine.fee, row.fee_usd);
    assert.equal(mine.headline.multiple, row.headline_multiple);
    assert.equal(mine.headline.cost, row.headline_cost_usd_month);
    assert.equal(mine.headline.inherited, row.headline_inherited);
    assert.equal(mine.modelCount, row.model_count);
    assert.equal(mine.varies, row.varies);
    assert.equal(mine.exceptions.length, row.exceptions.length);
    assert.equal(mine.best.point.api_cost_multiple, row.best_multiple);
    assert.equal(mine.worst.point.api_cost_multiple, row.worst_multiple);
    assert.deepEqual(
      mine.headline.rows.map((r) => r.point.model_display).sort(),
      [...row.headline_models].sort(),
    );
    assert.deepEqual(
      mine.exceptions.map((g) => g.multiple),
      row.exceptions.map((g: any) => g.multiple),
    );
    for (const [i, g] of mine.exceptions.entries())
      assert.deepEqual(
        g.rows.map((r) => r.point.model_display).sort(),
        [...row.exceptions[i].models].sort(),
      );
  }
  // Both sides must agree on the ranking the static chart publishes.
  assert.deepEqual(
    sortComparisons(computed, "value").map((p) => p.key),
    (published.plans as any[]).map((p) => p.plan_id),
  );
});
