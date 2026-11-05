import { expect, test } from "bun:test";
import { parseHTML } from "linkedom";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { GlassSurface } from "../src/components/newtab/toolbar/glass-surface";

test("a dense Icon surfaces grid does not create a masked compositor rim for every tile", () => {
	const { document } = parseHTML(
		renderToStaticMarkup(
			createElement(
				"div",
				null,
				Array.from({ length: 113 }, (_, key) =>
					createElement(
						GlassSurface,
						{ key, variant: "tile", className: "icon-glass-tile" },
						`App ${key}`,
					),
				),
			),
		),
	);
	expect(document.querySelectorAll('[data-glass-role="tile"]')).toHaveLength(
		113,
	);
	expect(
		document.querySelectorAll('[data-glass-backdrop="idle"]'),
	).toHaveLength(113);
	expect(document.querySelectorAll('[style*="mask:"]')).toHaveLength(0);
});

test("hero glass keeps its existing optical rim", () => {
	const { document } = parseHTML(
		renderToStaticMarkup(
			createElement(GlassSurface, { variant: "hero" }, "Search"),
		),
	);
	expect(document.querySelectorAll('[style*="mask:"]')).toHaveLength(1);
});
