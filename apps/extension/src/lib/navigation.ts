export type NavigationDirection = "forward" | "back";
export type NavigationKind = "root" | "depth";

export interface NavigationState {
	direction: NavigationDirection;
	kind: NavigationKind;
}
