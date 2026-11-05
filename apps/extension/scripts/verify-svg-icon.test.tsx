import { expect, test } from "bun:test";
import { parseHTML } from "linkedom";
import { renderToStaticMarkup } from "react-dom/server";
import { SvgIcon } from "../src/components/shared/svg-icon";

// Same resource structure as the Google brand: chained gradients, clipping
// and a filter. Its short IDs collide when raw SVG is repeated in a page.
const BRAND = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="268" height="274" fill="none" viewBox="0 0 268 274"><defs><linearGradient id="a"><stop stop-color="#fff"/></linearGradient><radialGradient id="b" xlink:href="#a"/><clipPath id="i"><path d="M0 0h268v274H0z"/></clipPath><filter id="q"><feGaussianBlur stdDeviation="1"/></filter><path id="mark" d="M0 0h20v20z"/></defs><g clip-path="url(#i)"><path fill="url(#b)" filter="url('#q')" d="M0 0h20v20z"/><use href="#mark"/></g></svg>`;

test("hidden search input, overlay and Quick Links never share SVG resource IDs", () => {
	const { document } = parseHTML(
		renderToStaticMarkup(
			<>
				<div style={{ visibility: "hidden" }}>
					<SvgIcon svgXml={BRAND} />
				</div>
				<SvgIcon svgXml={BRAND} />
				<SvgIcon svgXml={BRAND} />
			</>,
		),
	);
	const ids = [...document.querySelectorAll("[id]")].map(
		(element) => element.id,
	);
	expect(new Set(ids).size).toBe(ids.length);
	for (const svg of document.querySelectorAll("svg")) {
		for (const element of svg.querySelectorAll("*")) {
			for (const attribute of [...element.attributes]) {
				const ref =
					attribute.value.match(/^#(.+)$/)?.[1] && /href$/.test(attribute.name)
						? attribute.value.slice(1)
						: attribute.value.match(/url\(['"]?#([^)'"\s]+)/)?.[1];
				if (!ref) continue;
				expect(document.getElementById(ref)?.closest("svg")).toBe(svg);
			}
		}
	}
});

test("brand SVGs fill the icon viewport without clipping oversized intrinsic dimensions", () => {
	const { document } = parseHTML(
		renderToStaticMarkup(<SvgIcon svgXml={BRAND} className="size-5" />),
	);
	const svg = document.querySelector("svg");
	expect(svg?.getAttribute("width")).toBe("100%");
	expect(svg?.getAttribute("height")).toBe("100%");
	expect(svg?.getAttribute("viewBox")).toBe("0 0 268 274");
	expect(svg?.getAttribute("preserveAspectRatio")).toBe("xMidYMid meet");
	expect(svg?.querySelector("stop")?.getAttribute("stop-color")).toBe("#fff");
});

test("simple multicolor brands preserve their path colors and internal fills", () => {
	const { document } = parseHTML(
		renderToStaticMarkup(
			<SvgIcon svgXml='<svg viewBox="0 49.4 512 399.42"><g fill="none"><path fill="#4285f4" d="M0 0h10v10H0z"/></g></svg>' />,
		),
	);
	expect(document.querySelector("g")?.getAttribute("fill")).toBe("none");
	expect(document.querySelector("path")?.getAttribute("fill")).toBe("#4285f4");
});

test("embedded selectors and paint references are scoped without changing colors or external links", () => {
	const art =
		'<svg viewBox="0 0 24 24"><defs><linearGradient id="abc"/></defs><style>#mark:hover { fill: url(#abc); stroke: #abc; }</style><path id="mark"/><use href="https://example.com/art.svg#mark"/></svg>';
	const { document } = parseHTML(
		renderToStaticMarkup(<SvgIcon svgXml={art} />),
	);
	const css = document.querySelector("style")?.textContent;
	expect(css).toContain(`#${document.querySelector("path")?.id}:hover`);
	expect(css).toContain(
		`url(#${document.querySelector("linearGradient")?.id})`,
	);
	expect(css).toContain("stroke: #abc;");
	expect(document.querySelector("use")?.getAttribute("href")).toBe(
		"https://example.com/art.svg#mark",
	);
});
