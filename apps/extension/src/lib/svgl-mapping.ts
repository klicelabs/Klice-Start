/**
 * Maps internal search-engine ids and recommended-site URLs to SVGL titles.
 * SVGL uses the brand's canonical name as `title` — this is our lookup key.
 */
export const SEARCH_ENGINE_TO_SVGL: Record<string, string> = {
	google: "Google",
	bing: "Bing",
	duckduckgo: "DuckDuckGo",
	brave: "Brave",
	ecosia: "Ecosia",
};

/**
 * URL‑based lookup for recommended / dial-card sites.
 * Keyed by the site's hostname (lowercase, no www) for fast matching.
 */
export const SITE_URL_TO_SVGL: Record<string, string> = {
	"google.com": "Google",
	"youtube.com": "YouTube",
	"github.com": "GitHub",
	"chatgpt.com": "ChatGPT",
	"reddit.com": "Reddit",
	"open.spotify.com": "Spotify",
	"netflix.com": "Netflix",
	"vercel.com": "Vercel",
	"figma.com": "Figma",
	"linear.app": "Linear",
	"notion.so": "Notion",
	"discord.com": "Discord",
	"facebook.com": "Facebook",
	"instagram.com": "Instagram",
	"x.com": "X",
	"linkedin.com": "LinkedIn",
	"aws.amazon.com": "AWS",
	"cloudflare.com": "Cloudflare",
	"developer.mozilla.org": "MDN Web Docs",
	"stackoverflow.com": "Stack Overflow",
	"dribbble.com": "Dribbble",
	"behance.net": "Behance",
};
