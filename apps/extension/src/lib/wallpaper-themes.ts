/** Representative Pexels CDN previews for theme cards. These are direct image
 * loads (no API quota). Results remain random when a theme is selected. */
export const PEXELS_THEMES = [
	{
		id: "nature",
		label: "Nature",
		query: "cinematic nature landscape",
		preview:
			"https://images.pexels.com/photos/167699/pexels-photo-167699.jpeg?auto=compress&cs=tinysrgb&w=320&h=240&fit=crop",
	},
	{
		id: "mountains",
		label: "Mountains",
		query: "mountain landscape",
		preview:
			"https://images.pexels.com/photos/417074/pexels-photo-417074.jpeg?auto=compress&cs=tinysrgb&w=320&h=240&fit=crop",
	},
	{
		id: "ocean",
		label: "Ocean",
		query: "beach ocean landscape",
		preview:
			"https://images.pexels.com/photos/189349/pexels-photo-189349.jpeg?auto=compress&cs=tinysrgb&w=320&h=240&fit=crop",
	},
	{
		id: "space",
		label: "Space",
		query: "space nebula stars",
		preview:
			"https://images.pexels.com/photos/2150/sky-space-dark-galaxy.jpg?auto=compress&cs=tinysrgb&w=320&h=240&fit=crop",
	},
	{
		id: "cities",
		label: "Cities",
		query: "city architecture landscape",
		preview:
			"https://images.pexels.com/photos/466685/pexels-photo-466685.jpeg?auto=compress&cs=tinysrgb&w=320&h=240&fit=crop",
	},
	{
		id: "minimal",
		label: "Minimal",
		query: "minimalist landscape",
		preview:
			"https://images.pexels.com/photos/1323550/pexels-photo-1323550.jpeg?auto=compress&cs=tinysrgb&w=320&h=240&fit=crop",
	},
] as const;

export type PexelsTheme = (typeof PEXELS_THEMES)[number];

/** Representative preview for the Pexels source card in the wallpaper library. */
export const PEXELS_LIBRARY_PREVIEW =
	"https://images.pexels.com/photos/3225517/pexels-photo-3225517.jpeg?auto=compress&cs=tinysrgb&w=320&h=240&fit=crop";
