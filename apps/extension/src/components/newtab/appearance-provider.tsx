import { createContext, useContext, useMemo } from "react";
import { useSetupStore } from "../../stores/setup-store";
import type { AppearanceMode } from "../../types";

interface AppearanceContextValue {
	mode: AppearanceMode;
	isLiquid: boolean;
}

const AppearanceContext = createContext<AppearanceContextValue>({
	mode: "liquid",
	isLiquid: true,
});

export function AppearanceProvider({
	children,
}: {
	children: React.ReactNode;
}) {
	const mode = useSetupStore((s) => s.settings.appearanceMode);
	const value = useMemo(
		() => ({ mode, isLiquid: mode === "liquid" }),
		[mode],
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
