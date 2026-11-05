import { type RefObject, useLayoutEffect } from "react";

export function searchPlacement({
	anchor,
	frame,
	viewport,
	preferredWidth,
}: {
	anchor: { left: number; top: number; width: number } | null;
	frame: { left: number; top: number; width: number };
	viewport: { left: number; top: number; width: number; height: number };
	preferredWidth: number;
}) {
	const gutter = viewport.width < 640 ? 12 : 24;
	const leftEdge = Math.max(viewport.left + gutter, frame.left + gutter);
	const rightEdge = Math.min(
		viewport.left + viewport.width - gutter,
		frame.left + frame.width - gutter,
	);
	const width = Math.max(0, Math.min(preferredWidth, rightEdge - leftEdge));
	const origin = anchor ?? { left: frame.left, top: 0, width: frame.width };
	const left = Math.max(
		leftEdge,
		Math.min(origin.left + (origin.width - width) / 2, rightEdge - width),
	);
	const bottom = viewport.top + viewport.height;
	const toolbarTop = Math.max(viewport.top + 12, frame.top + 68);
	// Keep actual result rows visible, even with a tall hero or a software
	// keyboard. Move up before clipping the list down to its fixed chrome.
	const safeTop = bottom - toolbarTop >= 248 ? toolbarTop : viewport.top + 12;
	const minimumResults = Math.min(296, Math.max(0, bottom - safeTop - 78));
	const top = Math.max(
		safeTop,
		Math.min(anchor?.top ?? safeTop, bottom - 78 - minimumResults),
	);
	return {
		left,
		top,
		width,
		floating: !anchor || Math.abs(top - anchor.top) > 1,
		resultsHeight: Math.max(0, Math.min(432, bottom - top - 78)),
	};
}

export function useSearchPosition(
	open: boolean,
	preferredWidth: number,
	anchorRef: RefObject<HTMLDivElement | null>,
	overlayRef: RefObject<HTMLElement | null>,
	showBar = true,
) {
	useLayoutEffect(() => {
		if (!open) return;
		const anchor = anchorRef.current;
		const overlay = overlayRef.current;
		const frame = anchor?.closest<HTMLElement>("[data-speed-dial-frame]");
		if (!anchor || !overlay || !frame) return;
		let raf = 0;
		const sync = () => {
			raf = 0;
			const visual = window.visualViewport;
			const position = searchPlacement({
				anchor: showBar ? anchor.getBoundingClientRect() : null,
				frame: frame.getBoundingClientRect(),
				preferredWidth,
				viewport: {
					left: visual?.offsetLeft ?? 0,
					top: visual?.offsetTop ?? 0,
					width: visual?.width ?? window.innerWidth,
					height: visual?.height ?? window.innerHeight,
				},
			});
			overlay.style.width = `${position.width}px`;
			overlay.style.transform = `translate3d(${position.left}px, ${position.top}px, 0)`;
			overlay.style.setProperty(
				"--search-results-height",
				`${position.resultsHeight}px`,
			);
			overlay.dataset.searchFloating = String(position.floating);
			overlay.dataset.searchLayout =
				position.resultsHeight < 110
					? "minimal"
					: position.resultsHeight < 200
						? "compact"
						: "full";
		};
		const schedule = () => {
			if (!raf) raf = requestAnimationFrame(sync);
		};
		sync();
		const resize = new ResizeObserver(schedule);
		resize.observe(frame);
		resize.observe(anchor);
		window.addEventListener("scroll", schedule, true);
		window.addEventListener("resize", schedule);
		window.visualViewport?.addEventListener("resize", schedule);
		window.visualViewport?.addEventListener("scroll", schedule);
		return () => {
			resize.disconnect();
			window.removeEventListener("scroll", schedule, true);
			window.removeEventListener("resize", schedule);
			window.visualViewport?.removeEventListener("resize", schedule);
			window.visualViewport?.removeEventListener("scroll", schedule);
			if (raf) cancelAnimationFrame(raf);
		};
	}, [open, preferredWidth, anchorRef, overlayRef, showBar]);
}
