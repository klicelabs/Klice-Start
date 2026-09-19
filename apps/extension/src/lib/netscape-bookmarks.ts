import { isAbsoluteHttpUrl } from "./url";

export interface NetscapeLink {
	title: string;
	url: string;
}
export interface NetscapeFolder {
	name: string;
	links: NetscapeLink[];
	children: NetscapeFolder[];
	entries: Array<
		| ({ kind: "link" } & NetscapeLink)
		| { kind: "folder"; folder: NetscapeFolder }
	>;
	/** Netscape export marker for the browser's toolbar container. */
	personalToolbar?: boolean;
}

const MAX_INPUT_LENGTH = 10 * 1024 * 1024;
const MAX_DEPTH = 100;
const MAX_ENTRIES = 100_000;
// Netscape exports omit </DT>. HTML parsers repair that malformed shape in
// different ways, so parse the format's DL nesting directly from source tags.
const TAG = /<(?:!--[\s\S]*?--|(?:"[^"]*"|'[^']*'|[^'">])*)>/g;
const HREF = /\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i;

function decodeEntities(raw: string): string {
	if (!raw.includes("&")) return raw;
	const doc = new DOMParser().parseFromString(
		`<html><body><p>${raw}</p></body></html>`,
		"text/html",
	);
	return doc.querySelector("p")?.textContent ?? raw;
}

interface Level {
	links: NetscapeLink[];
	folders: NetscapeFolder[];
	entries: NetscapeFolder["entries"];
	pending: NetscapeFolder | null;
}

/** Parse an HTML bookmark export without depending on browser DOM error repair. */
export function parseNetscapeTree(fileText: string): {
	rootFolders: NetscapeFolder[];
	rootLinks: NetscapeLink[];
} {
	if (typeof fileText !== "string")
		throw new Error("Bookmark file must be provided as text.");
	if (fileText.length > MAX_INPUT_LENGTH)
		throw new Error(
			`Bookmark file exceeds maximum input length (${MAX_INPUT_LENGTH} characters).`,
		);
	const root: Level = { links: [], folders: [], entries: [], pending: null };
	const stack: Level[] = [];
	let count = 0;
	let capture: "h3" | "a" | null = null;
	let captured = "";
	let href = "";
	let headingTag = "";
	let cursor = 0;
	for (const match of fileText.matchAll(TAG)) {
		const tag = match[0];
		const position = match.index;
		if (capture) captured += fileText.slice(cursor, position);
		cursor = position + tag.length;
		if (tag.startsWith("<!--") || tag.startsWith("<!")) continue;
		const nameMatch = /^<\s*(\/?)\s*([a-zA-Z][a-zA-Z0-9]*)/.exec(tag);
		if (!nameMatch) continue;
		const closing = Boolean(nameMatch[1]);
		const name = nameMatch[2].toLowerCase();
		if (name === "dl") {
			if (closing) {
				if (stack.length) stack.pop();
			} else {
				const parent = stack.at(-1);
				if (parent?.pending) {
					const folder = parent.pending;
					parent.pending = null;
					stack.push({
						links: folder.links,
						folders: folder.children,
						entries: folder.entries,
						pending: null,
					});
				} else if (stack.length === 0) stack.push(root);
				else stack.push({ links: [], folders: [], entries: [], pending: null });
				if (stack.length > MAX_DEPTH + 1)
					throw new Error(
						`Bookmark file exceeds maximum folder nesting depth (${MAX_DEPTH}).`,
					);
			}
			continue;
		}
		const level = stack.at(-1);
		if (!level) continue;
		if (name === "dt" && !closing) {
			if (++count > MAX_ENTRIES)
				throw new Error(
					`Bookmark file contains too many entries (maximum ${MAX_ENTRIES}).`,
				);
			level.pending = null;
		} else if ((name === "h3" || name === "a") && !closing) {
			capture = name;
			captured = "";
			if (name === "h3") headingTag = tag;
			href =
				name === "a"
					? (HREF.exec(tag)
							?.slice(1)
							.find((value) => value !== undefined) ?? "")
					: "";
		} else if (name === capture && closing) {
			const title = decodeEntities(captured).trim();
			if (name === "h3") {
				const folder: NetscapeFolder = {
					name: title || "Untitled",
					links: [],
					children: [],
					entries: [],
					personalToolbar: /\bPERSONAL_TOOLBAR_FOLDER\s*=\s*["']?true\b/i.test(
						headingTag,
					),
				};
				level.folders.push(folder);
				level.entries.push({ kind: "folder", folder });
				level.pending = folder;
			} else {
				const url = decodeEntities(href);
				if (isAbsoluteHttpUrl(url)) {
					const link = { title: title || url, url };
					level.links.push(link);
					level.entries.push({ kind: "link", ...link });
				}
			}
			capture = null;
		}
	}
	if (root.links.length === 0 && root.folders.length === 0)
		throw new Error("No bookmarks found in file.");
	return { rootFolders: root.folders, rootLinks: root.links };
}
