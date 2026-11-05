/** One observer per scroll viewport, shared by repeated glass surfaces. */
type VisibilityListener = (visible: boolean) => void;
type BackdropPool = {
	observer: IntersectionObserver;
	listeners: Map<Element, VisibilityListener>;
};

const pools = new Map<Element | null, BackdropPool>();

export function observeBackdropVisibility(
	element: Element,
	onVisibility: VisibilityListener,
) {
	if (typeof IntersectionObserver === "undefined") {
		onVisibility(true);
		return () => {};
	}
	const root = element.closest("[data-speed-dial-scroll]");
	let pool = pools.get(root);
	if (!pool) {
		const listeners = new Map<Element, VisibilityListener>();
		const observer = new IntersectionObserver(
			(entries) => {
				for (const entry of entries)
					listeners.get(entry.target)?.(entry.isIntersecting);
			},
			{ root, rootMargin: "160px", threshold: 0 },
		);
		pool = { observer, listeners };
		pools.set(root, pool);
	}
	const ownedPool = pool;
	ownedPool.listeners.set(element, onVisibility);
	ownedPool.observer.observe(element);
	return () => {
		ownedPool.observer.unobserve(element);
		ownedPool.listeners.delete(element);
		if (ownedPool.listeners.size === 0) {
			ownedPool.observer.disconnect();
			pools.delete(root);
		}
	};
}
