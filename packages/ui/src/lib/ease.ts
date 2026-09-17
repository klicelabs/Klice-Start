export const EASE_OUT = [0.16, 1, 0.3, 1] as const;
export const EASE_IN_OUT = [0.77, 0, 0.175, 1] as const;
export const EASE_DRAWER = [0.32, 0.72, 0, 1] as const;

/** CSS string form of EASE_OUT for inline style transitions. */
export const EASE_OUT_CSS = "cubic-bezier(0.16, 1, 0.3, 1)";

/** CSS string form of EASE_IN_OUT, for on-screen movement. */
export const EASE_IN_OUT_CSS = "cubic-bezier(0.77, 0, 0.175, 1)";

/** CSS string form of EASE_DRAWER, for sheets and drawers. */
export const EASE_DRAWER_CSS = "cubic-bezier(0.32, 0.72, 0, 1)";

/** Press feedback on buttons and other tappable surfaces. */
export const SPRING_PRESS = {
	type: "spring",
	stiffness: 500,
	damping: 30,
	mass: 0.6,
} as const;

/** A selected segment sliding inside its track — crisp, barely overdamped. */
export const SPRING_SEGMENT = {
	type: "spring",
	stiffness: 520,
	damping: 38,
	mass: 0.6,
} as const;

/** Hierarchy depth changes (entering/leaving a subfolder) — deliberate body. */
export const SPRING_DEPTH = {
	type: "spring",
	stiffness: 300,
	damping: 34,
	mass: 0.8,
} as const;

/** App wake / Rest Mode exit — calm and critically damped, never overshoots. */
export const SPRING_WAKE = {
	type: "spring",
	stiffness: 200,
	damping: 26,
	mass: 0.8,
} as const;

/** Content swaps — label/icon slots trading places inside a control. */
export const SPRING_SWAP = {
	type: "spring",
	stiffness: 460,
	damping: 30,
	mass: 0.55,
} as const;

/** Overlay panel entrances — modals and sheets summoned by pointer. */
export const SPRING_PANEL = {
	type: "spring",
	stiffness: 420,
	damping: 40,
	mass: 0.5,
} as const;

/** Shared-layout glides — pills, indicators and panels morphing between positions. */
export const SPRING_LAYOUT = {
	type: "spring",
	stiffness: 360,
	damping: 32,
	mass: 0.6,
} as const;

/** Cursor-follow physics for decorative mouse tracking (magnetic, tilt, dock). */
export const SPRING_MOUSE = {
	stiffness: 200,
	damping: 15,
	mass: 0.3,
} as const;

/** Dragged handles and fills (sliders) — critically damped `useSpring` config,
 * so the value follows the pointer butterily and never rebounds off an end. */
export const SPRING_GLIDE = {
	stiffness: 700,
	damping: 50,
	mass: 0.5,
} as const;

/**
 * Live reorder displacement — utilitarian position communication, never
 * celebration. Siblings glide to their new slot with an interruptible
 * ease-out tween under 300ms. Springs are reserved for hierarchy travel
 * (SPRING_DEPTH) and must never drive reorder: overshoot reads as lag.
 */
export const REORDER_TWEEN = {
	duration: 0.2,
	ease: EASE_OUT,
} as const;
