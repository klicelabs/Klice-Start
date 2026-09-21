/**
 * Overlay-isolation A/B comparison (probe perf/probe-overlay-isolation,
 * Frente B). Reads transition-timeline JSONs produced under three
 * conditions — baseline, V1 unmount, V2 isolate — and prints the comparative
 * table the report needs:
 *
 *   Metric                              baseline  V1 unmount  V2 isolate
 *   tabbar-nav windowMs / fibers / commits / blockedMs
 *   open-folder-grid ...                ...       ...         ...
 *   back ...                            ...       ...         ...
 *   close-preferences ...               ...       ...         ...
 *   open-preferences 1st (rep 0, cold chunk+mount) windowMs / blocked
 *   open-preferences 2nd/3rd (reps 1-2, warm) windowMs / blocked / fibers
 *
 * Why the open-preferences split: the timeline bench pushes all 3 reps into
 * one series, but rep 0 pays the settings chunk load + first mount
 * (~309ms blocked) while reps 1-2 reuse the warm mounted panel (0-33ms).
 * Unmount-vs-isolate is decided exactly here: V1 re-pays the mount every
 * time, V2 keeps the warm DOM. Medians over the mixed series would hide it.
 *
 * All numbers are medians (reps=3 per condition). Fibers are exact counts
 * from the PerformedWork walk, not samples.
 *
 * Run: node scripts/bench-overlay-ab.mjs [baselineSuffix] [unmountSuffix] [isolateSuffix]
 *   Suffixes are the bench-transition-timeline filename infixes, e.g.
 *   `baseline` reads results/transition-timeline-baseline.json; use `-`
 *   for the canonical no-suffix file. Defaults: baseline unmount isolate.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const [baseSuf = "baseline", unmountSuf = "unmount", isolateSuf = "isolate"] =
	process.argv.slice(2);

function load(suffix) {
	const name =
		suffix === "-" ? "transition-timeline.json" : `transition-timeline-${suffix}.json`;
	const file = path.join(__dirname, "results", name);
	return { suffix, ...JSON.parse(fs.readFileSync(file, "utf8")) };
}

function med(values) {
	const v = values.filter((x) => x != null);
	if (!v.length) return null;
	const s = [...v].sort((a, b) => a - b);
	const mid = Math.floor(s.length / 2);
	return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

const METRICS = ["windowMs", "inputToCommit1Ms", "commits", "fibersTotal", "blockedMs", "maxGapMs"];

function seriesOf(data, label) {
	return data.raw?.[label] ?? [];
}

/** Median of a metric over a raw series. */
function medOf(series, field) {
	return med(series.map((r) => r[field]));
}

function row(data, label, field) {
	return medOf(seriesOf(data, label), field);
}

function pctDelta(variant, base) {
	if (variant == null || base == null || base === 0) return "—";
	const d = ((variant - base) / base) * 100;
	return `${d > 0 ? "+" : ""}${Math.round(d)}%`;
}

const conditions = [load(baseSuf), load(unmountSuf), load(isolateSuf)];
const [BASE, V1, V2] = conditions;
const labels = ["tabbar-nav", "open-folder-grid", "back", "close-preferences"];

const repsOf = (data) =>
	data.medians?.["tabbar-nav"]?.reps ?? data.medians?.["close-preferences"]?.reps ?? "?";
console.log(`A/B conditions (reps each): baseline=${repsOf(BASE)} unmount=${repsOf(V1)} isolate=${repsOf(V2)}`);
console.log(`dates: baseline=${BASE.date} unmount=${V1.date} isolate=${V2.date}\n`);

const table = [];
for (const label of labels) {
	for (const m of METRICS) {
		const b = row(BASE, label, m);
		const v1 = row(V1, label, m);
		const v2 = row(V2, label, m);
		table.push({
			metric: `${label} ${m}`,
			baseline: b,
			unmount: `${v1} (${pctDelta(v1, b)})`,
			isolate: `${v2} (${pctDelta(v2, b)})`,
		});
	}
}
// open-preferences: rep 0 (cold) vs reps 1-2 (warm) — the discriminating cut.
for (const [tag, idx] of [["open-prefs 1st (rep0 cold)", [0]], ["open-prefs 2nd/3rd (reps1-2 warm)", [1, 2]]]) {
	for (const m of ["windowMs", "blockedMs", "fibersTotal", "commits"]) {
		const pick = (data) => {
			const s = seriesOf(data, "open-preferences").filter((_, i) => idx.includes(i));
			return medOf(s, m);
		};
		const b = pick(BASE);
		const v1 = pick(V1);
		const v2 = pick(V2);
		table.push({
			metric: `${tag} ${m}`,
			baseline: b,
			unmount: `${v1} (${pctDelta(v1, b)})`,
			isolate: `${v2} (${pctDelta(v2, b)})`,
		});
	}
}
// close-preferences reps are homogeneous; keep the median row already added,
// plus fibers-only sanity (all reps identical by construction).
console.table(table);

// Verdict aid: who wins transitions (mean of windowMs deltas) vs reopen cost.
function meanWindowDelta(variant, labels) {
	const ds = labels.map((l) => {
		const b = row(BASE, l, "windowMs");
		const v = row(variant, l, "windowMs");
		return b ? (v - b) / b : null;
	}).filter((x) => x != null);
	return ds.reduce((a, x) => a + x, 0) / ds.length;
}
console.log("\nMean windowMs delta on transitions (tabbar/open-folder/back/close-prefs):");
for (const [name, data] of [["V1 unmount", V1], ["V2 isolate", V2]]) {
	console.log(`  ${name}: ${Math.round(meanWindowDelta(data, labels) * 100)}%`);
}
const warm = (data) =>
	medOf(seriesOf(data, "open-preferences").filter((_, i) => i > 0), "windowMs");
console.log("Warm reopen (open-prefs reps1-2 windowMs median):");
for (const [name, data] of [["baseline", BASE], ["V1 unmount", V1], ["V2 isolate", V2]]) {
	console.log(`  ${name}: ${warm(data)}ms`);
}
