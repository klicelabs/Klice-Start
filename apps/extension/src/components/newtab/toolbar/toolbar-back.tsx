import { ToolbarIconButton } from "./toolbar-icon-button";

interface ToolbarBackProps {
	onBack: () => void;
}

/**
 * Back chevron - a standalone glass circle (the button *is* the glass, no
 * surrounding pill). See {@link ToolbarIconButton}.
 */
export function ToolbarBack({ onBack }: ToolbarBackProps) {
	return (
		<ToolbarIconButton icon="chevron-left" label="Go back" onClick={onBack} />
	);
}
