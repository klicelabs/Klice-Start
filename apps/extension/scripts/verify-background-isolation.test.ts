import { expect, test } from "bun:test";
import { fileURLToPath } from "node:url";

test("background capture survives a pending popup write from an earlier suite", {
	timeout: 30_000,
}, async () => {
	const child = Bun.spawn(
		[
			process.execPath,
			"test",
			"--preload",
			"./scripts/fixtures/pending-popup-write.ts",
			"./scripts/verify-background-thumbnail.test.ts",
		],
		{
			cwd: fileURLToPath(new URL("../", import.meta.url)),
			stdout: "pipe",
			stderr: "pipe",
		},
	);
	const [exitCode, stdout, stderr] = await Promise.all([
		child.exited,
		new Response(child.stdout).text(),
		new Response(child.stderr).text(),
	]);
	expect({ exitCode, output: exitCode === 0 ? "" : stdout + stderr }).toEqual({
		exitCode: 0,
		output: "",
	});
});
