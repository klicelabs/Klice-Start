/**
 * Chrome API — natively available in all extension contexts.
 * WXT provides `browser` for background/service-worker contexts.
 * For pages (newtab, popup), `chrome` is the native API.
 *
 * We declare minimal types for the subset of chrome.* we use,
 * to avoid a dependency on @types/chrome.
 */

declare namespace chrome {
	namespace storage {
		interface StorageArea {
			get(
				keys: string | string[] | Record<string, unknown>,
			): Promise<Record<string, unknown>>;
			set(items: Record<string, unknown>): Promise<void>;
			remove(keys: string | string[]): Promise<void>;
			clear(): Promise<void>;
		}
		type StorageChange = {
			newValue?: unknown;
			oldValue?: unknown;
		};
		type OnChangedCallback = (
			changes: Record<string, StorageChange>,
			areaName: string,
		) => void;
		const local: StorageArea;
		const onChanged: {
			addListener(callback: OnChangedCallback): void;
			removeListener(callback: OnChangedCallback): void;
		};
	}

	namespace tabs {
		interface Tab {
			id?: number;
			index: number;
			windowId?: number;
			url?: string;
			title?: string;
			favIconUrl?: string;
			status?: string;
			active?: boolean;
		}
		function query(queryInfo: {
			active?: boolean;
			currentWindow?: boolean;
		}): Promise<Tab[]>;
		function get(tabId: number): Promise<Tab>;
		function captureVisibleTab(options?: {
			format?: string;
			quality?: number;
		}): Promise<string>;
		function captureVisibleTab(
			windowId: number,
			options?: { format?: string; quality?: number },
		): Promise<string>;
	}

	namespace contextMenus {
		interface OnClickData {
			menuItemId: string | number;
		}
		function create(createProperties: {
			id?: string;
			title?: string;
			contexts?: string[];
		}): void;
		const onClicked: {
			addListener(callback: (info: OnClickData, tab?: tabs.Tab) => void): void;
		};
	}

	namespace commands {
		interface CommandEvent {
			addListener(callback: (command: string) => void): void;
		}
		const onCommand: CommandEvent;
	}

	namespace runtime {
		interface InstalledDetails {
			reason: string;
		}
		const onInstalled: {
			addListener(callback: (details: InstalledDetails) => void): void;
		};
	}

	namespace action {
		function setBadgeBackgroundColor(details: { color: string }): void;
		function setBadgeText(details: { text: string }): void;
	}

	namespace bookmarks {
		interface BookmarkTreeNode {
			id: string;
			title: string;
			url?: string;
			children?: BookmarkTreeNode[];
			dateAdded?: number;
		}
		function getTree(): Promise<BookmarkTreeNode[]>;
	}
}
