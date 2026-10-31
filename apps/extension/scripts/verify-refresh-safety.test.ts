import { expect, test } from "bun:test";
import { fileURLToPath } from "node:url";

test.each(["stale", "adopted", "fatal"])("refresh safety: %s", async (mode) => {
	const child = Bun.spawn(
		[process.execPath, "scripts/fixtures/refresh-stale-owner.ts", mode],
		{
			cwd: fileURLToPath(new URL("..", import.meta.url)),
			stdout: "pipe",
			stderr: "pipe",
		},
	);
	const [exit, stderr] = await Promise.all([
		child.exited,
		new Response(child.stderr).text(),
	]);
	expect(stderr).toBe("");
	expect(exit).toBe(0);
});
