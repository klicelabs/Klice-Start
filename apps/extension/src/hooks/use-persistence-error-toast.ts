import { useEffect } from "react";
import { toast } from "sonner";
import { subscribeToPersistenceErrors } from "../lib/storage";

const PERSISTENCE_ERROR_TOAST_ID = "klice-persistence-error";

/** Keep storage failures visible without adding status chrome to Settings. */
export function usePersistenceErrorToast(): void {
	useEffect(
		() =>
			subscribeToPersistenceErrors(() => {
				toast.error("Changes couldn't be saved", {
					id: PERSISTENCE_ERROR_TOAST_ID,
					description: "Try again in a moment.",
				});
			}),
		[],
	);
}
