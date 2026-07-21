import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
	client: {},
	server: {
		PEXELS_API_KEY: z.string().min(1).optional(),
	},
	runtimeEnv: {
		PEXELS_API_KEY: process.env.PEXELS_API_KEY,
	},
	skipValidation: !!process.env.SKIP_ENV_VALIDATION,
	emptyStringAsUndefined: true,
});
