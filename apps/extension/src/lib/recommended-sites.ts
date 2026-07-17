import type { SiteSuggestion } from "../types";

/**
 * Curated catalog of popular sites shown in the "Add link" dialog.
 * Favicons are resolved at render time via faviconUrl(url) — we only store the
 * canonical destination and a display name here.
 */
export const RECOMMENDED_SITES: SiteSuggestion[] = [
	{ name: "Google", url: "https://www.google.com" },
	{ name: "YouTube", url: "https://www.youtube.com" },
	{ name: "GitHub", url: "https://github.com" },
	{ name: "ChatGPT", url: "https://chatgpt.com" },
	{ name: "Reddit", url: "https://www.reddit.com" },
	{ name: "Spotify", url: "https://open.spotify.com" },
	{ name: "Netflix", url: "https://www.netflix.com" },
	{ name: "Vercel", url: "https://vercel.com" },
	{ name: "Figma", url: "https://www.figma.com" },
	{ name: "Linear", url: "https://linear.app" },
	{ name: "Notion", url: "https://www.notion.so" },
	{ name: "Discord", url: "https://discord.com" },
	{ name: "Facebook", url: "https://www.facebook.com" },
	{ name: "Instagram", url: "https://www.instagram.com" },
	{ name: "X", url: "https://x.com" },
	{ name: "LinkedIn", url: "https://www.linkedin.com" },
	{ name: "AWS", url: "https://aws.amazon.com" },
	{ name: "Cloudflare", url: "https://www.cloudflare.com" },
	{ name: "MDN", url: "https://developer.mozilla.org" },
	{ name: "Stack Overflow", url: "https://stackoverflow.com" },
	{ name: "Dribbble", url: "https://dribbble.com" },
	{ name: "Behance", url: "https://www.behance.net" },
];
