import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { ACCENT_COLORS } from "../../lib/accent";
import { useSetupStore } from "../../stores/setup-store";
import type { AccentColor, AppearanceMode, ColorScheme } from "../../types";

export interface AppearanceContextValue {
	mode: AppearanceMode;
	isLiquid: boolean;
	colorScheme: ColorScheme;
	accentColor: AccentColor;
	resolvedDark: boolean;
}

const AppearanceContext = createContext<AppearanceContextValue>({
	mode: "liquid",
	isLiquid: true,
	colorScheme: "auto",
	accentColor: "blue",
	resolvedDark: true,
});

export function AppearanceProvider({
	children,
}: {
	children: React.ReactNode;
}) {
	const mode = useSetupStore((s) => s.settings.appearanceMode);
	const colorScheme = useSetupStore((s) => s.settings.colorScheme ?? "auto");
	const accentColor = useSetupStore((s) => s.settings.accentColor ?? "blue");

	const [systemDark, setSystemDark] = useState<boolean>(() => {
		if (typeof window === "undefined") return true;
		return window.matchMedia("(prefers-color-scheme: dark)").matches;
	});

	useEffect(() => {
		if (typeof window === "undefined") return;
		const mql = window.matchMedia("(prefers-color-scheme: dark)");
		const handler = (e: MediaQueryListEvent) => setSystemDark(e.matches);
		mql.addEventListener("change", handler);
		return () => mql.removeEventListener("change", handler);
	}, []);

	const resolvedDark =
		colorScheme === "dark" || (colorScheme === "auto" && systemDark);
	const accent = ACCENT_COLORS[accentColor] ?? ACCENT_COLORS.blue;

	useEffect(() => {
		if (typeof document === "undefined") return;
		if (resolvedDark) {
			document.documentElement.classList.add("dark");
			document.documentElement.classList.remove("light");
		} else {
			document.documentElement.classList.add("light");
			document.documentElement.classList.remove("dark");
		}
	}, [resolvedDark]);

	useEffect(() => {
		if (typeof document === "undefined") return;
		const root = document.documentElement;
		const value = resolvedDark ? accent.dark : accent.light;
		root.style.setProperty("--klice-accent", value);
		root.style.setProperty("--klice-accent-foreground", accent.foreground);
		root.style.setProperty("--klice-accent-rgb", accent.rgb);
		// Existing semantic surfaces use this established alias. Keep it mapped
		// to the new single accent source while migrating no decorative colors.
		root.style.setProperty("--apple-blue", value);
	}, [accent, resolvedDark]);

	const value = useMemo(
		() => ({
			mode,
			isLiquid: mode === "liquid",
			colorScheme,
			accentColor,
			resolvedDark,
		}),
		[mode, colorScheme, accentColor, resolvedDark],
	);

	return (
		<AppearanceContext.Provider value={value}>
			{children}
		</AppearanceContext.Provider>
	);
}

export function useAppearance(): AppearanceContextValue {
	return useContext(AppearanceContext);
}
