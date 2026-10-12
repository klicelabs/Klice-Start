import type { SelectionItem } from "../stores/selection-store";

/** Gesture membership is latched by ID. Geometry may scroll away or disappear.
 * A crossed item is added/flipped once, relative to the gesture-start snapshot.
 */
export function mergeMarqueeSelection(
	snapshot: readonly SelectionItem[],
	crossed: ReadonlyMap<string, SelectionItem>,
	mode: "add" | "toggle",
): SelectionItem[] {
	const snapshotIds = new Set(snapshot.map((item) => item.id));
	const result =
		mode === "add"
			? [...snapshot]
			: snapshot.filter((item) => !crossed.has(item.id));
	for (const item of crossed.values()) {
		if (!snapshotIds.has(item.id)) result.push(item);
	}
	return result;
}
