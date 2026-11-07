import { PexelsProxy } from "@/lib/pexels-proxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const ephemeralRuntime = Boolean(
	process.env.VERCEL ||
		process.env.AWS_LAMBDA_FUNCTION_NAME ||
		process.env.NETLIFY,
);
const proxy = new PexelsProxy({
	apiKey: process.env.PEXELS_API_KEY,
	directory: ephemeralRuntime
		? undefined
		: process.env.PEXELS_CACHE_DIR ||
			(process.env.NODE_ENV === "development" ? ".cache/pexels" : undefined),
	trustedClientHeader: process.env.PEXELS_TRUSTED_CLIENT_HEADER,
});
export async function POST(request: Request) {
	return proxy.handle(request);
}
export function OPTIONS() {
	return new Response(null, {
		status: 204,
		headers: {
			"Access-Control-Allow-Origin": "*",
			"Access-Control-Allow-Methods": "POST, OPTIONS",
			"Access-Control-Allow-Headers": "Content-Type",
			"Access-Control-Max-Age": "86400",
		},
	});
}
