#!/usr/bin/env node
/**
 * Wallpaper asset pipeline.
 *
 * Regenerates the shipped wallpaper variants from the master originals in
 * assets/wallpapers-master/. Masters never ship; public/wallpapers/ contains
 * only optimized output:
 *
 *   public/wallpapers/<id>.avif         — display variant, max width 2560px
 *   public/wallpapers/thumbs/<id>.avif  — picker thumbnail, 320px wide
 *
 * Requires ffmpeg with libsvtav1 + libwebp (AVIF muxer). Run from
 * apps/extension:  bun run wallpapers:optimize
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const MASTER_DIR = path.join(ROOT, "assets", "wallpapers-master");
const OUT_DIR = path.join(ROOT, "public", "wallpapers");
const THUMB_DIR = path.join(OUT_DIR, "thumbs");

const MAIN_MAX_WIDTH = 2560;
const MAIN_CRF = 30;
const THUMB_WIDTH = 320;
const THUMB_CRF = 34;

function encode(input, output, { width, crf, preset }) {
	const vf = `scale='min(${width},iw)':-2`;
	execFileSync(
		"ffmpeg",
		[
			"-hide_banner",
			"-loglevel",
			"error",
			"-y",
			"-i",
			input,
			"-vf",
			vf,
			"-c:v",
			"libsvtav1",
			"-crf",
			String(crf),
			"-preset",
			String(preset),
			"-an",
			output,
		],
		{ stdio: ["ignore", "inherit", "inherit"] },
	);
}

function main() {
	if (!existsSync(MASTER_DIR)) {
		console.error(`Master directory missing: ${MASTER_DIR}`);
		process.exit(1);
	}
	mkdirSync(THUMB_DIR, { recursive: true });

	const masters = readdirSync(MASTER_DIR).filter((f) =>
		/\.(jpe?g|png|avif|webp)$/i.test(f),
	);
	if (masters.length === 0) {
		console.error("No master wallpapers found.");
		process.exit(1);
	}

	let total = 0;
	for (const file of masters) {
		const id = path.basename(file, path.extname(file));
		const input = path.join(MASTER_DIR, file);
		const mainOut = path.join(OUT_DIR, `${id}.avif`);
		const thumbOut = path.join(THUMB_DIR, `${id}.avif`);

		console.log(`• ${id}`);
		encode(input, mainOut, {
			width: MAIN_MAX_WIDTH,
			crf: MAIN_CRF,
			preset: 6,
		});
		encode(input, thumbOut, { width: THUMB_WIDTH, crf: THUMB_CRF, preset: 8 });
		total += 2;
	}
	console.log(`Done: ${total} files written to ${path.relative(ROOT, OUT_DIR)}`);
}

main();
