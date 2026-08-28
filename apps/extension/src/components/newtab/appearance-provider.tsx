import {
	createContext,
	useContext,
	useEffect,
	useMemo,
	useState,
} from "react";
import { useSetupStore } from "../../stores/setup-store";
import type { AppearanceMode, ColorScheme } from "../../types";

export interface AppearanceContextValue {
	mode: AppearanceMode;
	isLiquid: boolean;
	colorScheme: ColorScheme;
	resolvedDark: boolean;
}

const AppearanceContext = createContext<AppearanceContextValue>({
	mode: "liquid",
	isLiquid: true,
	colorScheme: "auto",
	resolvedDark: true,
});

export function AppearanceProvider({
	children,
}: {
	children: React.ReactNode;
}) {
	const mode = useSetupStore((s) => s.settings.appearanceMode);
	const colorScheme = useSetupStore((s) => s.settings.colorScheme ?? "auto");

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

	const value = useMemo(
		() => ({
			mode,
			isLiquid: mode === "liquid",
			colorScheme,
			resolvedDark,
		}),
		[mode, colorScheme, resolvedDark],
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
