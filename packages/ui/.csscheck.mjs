import postcss from "postcss";
import tailwind from "@tailwindcss/postcss";
import { readFileSync, writeFileSync } from "node:fs";

const css = readFileSync("src/styles/globals.css", "utf8");
const res = await postcss([tailwind()]).process(css, {
	from: "src/styles/globals.css",
});
writeFileSync("../../.csscheck-out.css", res.css);
console.log("emitted bytes:", res.css.length);
for (const u of [
	"face-control",
	"face-segment",
	"face-segment-selected",
	"face-sunken",
	"face-solid",
	"face-thumb",
	"face-panel",
	"groove",
	"groove-v",
	"ink-engraved",
]) {
	console.log(u, res.css.includes(`.${u}`) ? "OK" : "MISSING");
}
for (const v of [
	"--elevation-control",
	"--elevation-dialog",
	"--flat-face-top",
	"--flat-panel-top",
	"--shadow-menu",
]) {
	console.log(v, res.css.includes(v) ? "OK" : "MISSING");
}
