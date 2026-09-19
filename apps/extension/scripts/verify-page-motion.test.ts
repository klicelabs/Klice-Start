import { expect, test } from "bun:test";
import { type PageMotionContext, pageMotion } from "../src/lib/page-motion";

function offset(
	context: PageMotionContext,
	phase: "initial" | "animate" | "exit",
) {
	return pageMotion(context, phase).transform;
}

test("forward and back enter/exit through reversible positions", () => {
	for (const kind of ["root", "depth", "settings"] as const) {
		const forward = {
			kind,
			direction: "forward",
			reduceMotion: false,
		} as const;
		const back = { kind, direction: "back", reduceMotion: false } as const;
		expect(offset(forward, "initial")).toBe(offset(back, "exit"));
		expect(offset(forward, "exit")).toBe(offset(back, "initial"));
		expect(offset(forward, "animate")).toBe("translate3d(0px, 0, 0)");
	}
});

test("page motion is bounded, quick, and removes travel for reduced motion", () => {
	for (const kind of ["root", "depth", "settings"] as const) {
		const context = {
			kind,
			direction: "forward",
			reduceMotion: false,
		} as const;
		const entering = pageMotion(context, "initial");
		const leaving = pageMotion(context, "exit");
		const travel = Number(
			String(entering.transform).match(/translate3d\((-?\d+)px/)?.[1],
		);
		expect(travel).toBeGreaterThan(0);
		expect(travel).toBeLessThanOrEqual(32);
		expect(Number(leaving.transition?.duration)).toBeLessThan(0.3);
		expect(offset({ ...context, reduceMotion: true }, "initial")).toBe(
			"translate3d(0px, 0, 0)",
		);
	}
});
