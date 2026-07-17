import { Button } from "@perch/ui/components/button";
import { Icon } from "@perch/ui/icons/icon";

interface AddShortcutButtonProps {
	onClick: () => void;
}

export function AddShortcutButton({ onClick }: AddShortcutButtonProps) {
	return (
		<div className="add-shortcut-row mt-8 mb-12 flex justify-center">
			<Button
				variant="outline"
				className="flex items-center gap-2 rounded-xl px-5 py-2.5 font-medium text-[13px]"
				onClick={onClick}
			>
				<Icon name="plus" size={14} />
				Add Shortcut
			</Button>
		</div>
	);
}
