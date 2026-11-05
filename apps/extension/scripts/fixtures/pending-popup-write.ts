// Preload for the background isolation regression. Reproduce the 200ms write
// left by a popup suite immediately before the worker installs its own shim.
export {};

const scope = globalThis as Record<string, unknown>;
scope.chrome = {
	storage: {
		local: {
			get: async () => ({}),
			set: async () => undefined,
			remove: async () => undefined,
		},
	},
};
const { chromeStorageAdapter, normalizeState } = await import(
	"../../src/lib/storage"
);
void chromeStorageAdapter.setItem("perch-setup", {
	state: normalizeState(null),
	version: 0,
});
await Promise.resolve();
