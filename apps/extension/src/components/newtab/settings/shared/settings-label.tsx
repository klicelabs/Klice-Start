import type { ReactNode } from "react";
import { SettingsTooltip } from "./settings-tooltip";
import { SETTINGS_LABEL } from "./settings-tokens";

interface SettingsLabelProps {
	/** Pairs the visible label with its row for assistive tech. */
	id?: string;
	children: ReactNode;
	/**
	 * Help context for the beUI tooltip trigger. Callers resolve the
	 * description-vs-tooltip rule before passing — a label never shows both.
	 */
	tooltip?: ReactNode;
}

/**
 * The single label anatomy for Settings: `[label] [?]`.
 *
 * Label + help trigger form one `inline-flex items-center` group with one
 * shared gap, so the trigger always sits optically centred on the text —
 * never floating, never nudged with local margins. The trigger itself is a
 * 16px box with a 12px muted glyph, identical on every row that has one.
 */
export function SettingsLabel({ id, children, tooltip }: SettingsLabelProps) {
	return (
		<span id={id} className={SETTINGS_LABEL}>
			<span className="inline-flex items-center gap-1.5">
				{children}
				{tooltip ? <SettingsTooltip content={tooltip} /> : null}
			</span>
		</span>
	);
}
