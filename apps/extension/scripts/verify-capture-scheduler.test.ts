import { expect, test } from "bun:test";
import { createCaptureScheduler } from "../src/lib/capture-scheduler";

test("all capture producers share one quota lane, including rejected attempts", async () => {
	let now = 0;
	const attempts: number[] = [];
	const schedule = createCaptureScheduler(
		() => now,
		async (ms) => {
			now += ms;
		},
	);
	const capture = async () => {
		attempts.push(now);
		return "pixels";
	};
	const results = await Promise.allSettled([
		schedule(capture),
		schedule(async () => {
			attempts.push(now);
			throw new Error("not ready");
		}),
		schedule(capture),
	]);
	expect(attempts).toEqual([0, 1500, 3000]);
	expect(results.map((result) => result.status)).toEqual([
		"fulfilled",
		"rejected",
		"fulfilled",
	]);
});

test("a new capture waits for the previous capture to finish", async () => {
	let now = 0;
	const schedule = createCaptureScheduler(
		() => now,
		async (ms) => {
			now += ms;
		},
	);
	const events: string[] = [];
	let complete!: () => void;
	const first = schedule(
		() =>
			new Promise<string>((resolve) => {
				events.push("first");
				complete = () => {
					now = 2000;
					resolve("pixels");
				};
			}),
	);
	const second = schedule(async () => {
		events.push("second");
		return "pixels";
	});
	await new Promise((resolve) => setTimeout(resolve, 0));
	expect(events).toEqual(["first"]);
	complete();
	await Promise.all([first, second]);
	expect(events).toEqual(["first", "second"]);
});
