import { Button } from "@perch/ui/components/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@perch/ui/components/dialog";
import { Input } from "@perch/ui/components/input";
import { Label } from "@perch/ui/components/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@perch/ui/components/select";
import { Separator } from "@perch/ui/components/separator";
import {
	Sheet,
	SheetContent,
	SheetHeader,
	SheetTitle,
} from "@perch/ui/components/sheet";
import { Slider } from "@perch/ui/components/slider";
import { Switch } from "@perch/ui/components/switch";
import type { IconName } from "@perch/ui/icons/icon";
import { Icon } from "@perch/ui/icons/icon";
import { type ChangeEvent, type ReactNode, useRef, useState } from "react";
import { GRADIENTS, SEARCH_ENGINES } from "../../lib/constants";
import { exportBackup, importBackup } from "../../services/backup";
import { importBrowserBookmarks } from "../../services/bookmarks-import";
import { useImageStore } from "../../stores/image-store";
import { useSetupStore } from "../../stores/setup-store";
import type { Settings } from "../../types";

const ENGINE_ICONS: Record<string, ReactNode> = {
	google: (
		<svg
			viewBox="0 0 268 274"
			className="size-4"
			fill="none"
			xmlns="http://www.w3.org/2000/svg"
		>
			<path
				d="M234.996 191.21v57.498h136.006c1.196-7.874 5.152-18.064 5.152-26.5 0-9.858-.996-21.899-2.687-30.998Z"
				fill="#3086ff"
				filter="url(#k)"
			/>
			<path
				d="M92.076 219.958c.148 22.14 6.501 44.983 16.117 63.424v.127c6.949 13.392 16.445 23.97 27.26 34.452l65.327-23.67c-12.36-6.235-14.246-10.055-23.105-17.026-9.054-9.066-15.802-19.473-20.004-31.677h-.17l.17-.127c-2.765-8.058-3.037-16.613-3.14-25.503Z"
				fill="url(#l)"
			/>
			<path
				d="M237.083 79.025c-6.456 22.526-3.988 44.421 0 57.161 7.457.006 14.64.888 21.45 2.647a77.662 77.662 0 0 1 33.424 18.25l41.88-40.726c-24.81-22.59-54.667-37.297-96.754-37.332Z"
				fill="url(#m)"
			/>
			<path
				d="M236.943 78.847c-31.67 0-60.91 9.798-84.871 26.359a145.533 145.533 0 0 0-24.332 21.15c-1.904 17.744 14.257 39.551 46.262 39.37 15.528-17.936 38.495-29.542 64.056-29.542l.07.002-1.044-57.335c-.048 0-.093-.004-.14-.004Z"
				fill="url(#n)"
			/>
			<path
				d="m341.475 226.379-28.268 19.285c-1.24 7.562-4.028 15.002-8.107 21.786-4.674 7.772-10.45 13.69-16.373 18.196-17.702 13.47-38.328 16.244-52.687 16.255-14.842 25.102-17.444 37.675 1.043 57.934 22.877-.016 43.157-4.117 61.046-11.796 12.931-5.551 24.388-12.792 34.761-22.097 13.706-12.295 24.442-27.503 31.769-45 7.327-17.497 11.245-37.282 11.245-58.734Z"
				fill="url(#o)"
			/>
			<path
				d="M128.39 124.327c-8.394 9.119-15.564 19.326-21.249 30.364-9.753 18.879-15.094 41.83-15.094 64.324 0 .317.026.627.029.944 4.32 8.224 59.666 6.649 62.456 0-.004-.31-.039-.613-.039-.924 0-9.226 1.57-16.026 4.43-24.367 3.53-10.289 9.056-19.763 16.123-27.926 1.602-2.031 5.875-6.397 7.121-9.016.475-.997-.862-1.557-.937-1.908-.083-.393-1.876-.077-2.277-.37-1.275-.929-3.8-1.414-5.334-1.845-3.277-.921-8.708-2.953-11.725-5.06-9.536-6.658-24.417-14.612-33.505-24.216Z"
				fill="url(#p)"
			/>
			<path
				d="M171.099 290.222c-29.683 10.641-34.33 11.023-37.062 29.29a144.806 144.806 0 0 0 16.792 13.984c15.996 11.386 46.766 26.551 86.118 26.551.046 0 .09-.004.137-.004v-59.157l-.094.002c-14.736 0-26.512-3.843-38.585-10.527-2.977-1.648-8.378 2.777-11.123.799-3.786-2.729-12.9 2.35-16.183-.938Z"
				fill="url(#r)"
			/>
		</svg>
	),
	bing: (
		<svg
			viewBox="0 0 256 388"
			className="size-4"
			xmlns="http://www.w3.org/2000/svg"
		>
			<path
				d="M129.424 122.047c-7.133.829-12.573 6.622-13.079 13.928-.218 3.147-.15 3.36 6.986 21.722 16.233 41.774 20.166 51.828 20.827 53.243 1.603 3.427 3.856 6.65 6.672 9.544 2.16 2.22 3.585 3.414 5.994 5.024 4.236 2.829 6.337 3.61 22.818 8.49 16.053 4.754 24.824 7.913 32.381 11.664 9.791 4.86 16.623 10.387 20.944 16.946 3.1 4.706 5.846 13.145 7.04 21.64.468 3.321.47 10.661.006 13.663-1.008 6.516-3.021 11.976-6.101 16.545-1.638 2.43-1.068 2.023 1.313-.939 6.74-8.379 13.605-22.7 17.108-35.687 4.24-15.718 4.817-32.596 1.66-48.57-6.147-31.108-25.786-57.955-53.444-73.06-1.738-.95-8.357-4.42-17.331-9.085-1.362-.708-3.219-1.678-4.127-2.154-.907-.477-2.764-1.447-4.126-2.154-1.362-.708-5.282-2.75-8.711-4.539l-8.528-4.446a6021.14 6021.14 0 0 1-8.344-4.357c-8.893-4.655-12.657-6.537-13.73-6.863-1.125-.343-3.984-.782-4.701-.723-.152.012-.838.088-1.527.168Z"
				fill="url(#a)"
			/>
			<path
				d="M148.81 277.994c-.493.292-1.184.714-1.537.938-.354.225-1.137.712-1.743 1.083a8315.383 8315.383 0 0 0-13.204 8.137 2847.83 2847.83 0 0 0-8.07 4.997 388.04 388.04 0 0 1-3.576 2.198c-.454.271-2.393 1.465-4.31 2.654a2651.466 2651.466 0 0 1-7.427 4.586 3958.037 3958.037 0 0 0-8.62 5.316 3011.146 3011.146 0 0 1-7.518 4.637c-1.564.959-3.008 1.885-3.21 2.058-.3.257-14.205 8.87-21.182 13.121-5.3 3.228-11.43 5.387-17.705 6.235-2.921.395-8.45.396-11.363.003-7.9-1.067-15.176-4.013-21.409-8.666-2.444-1.826-7.047-6.425-8.806-8.8-4.147-5.598-6.829-11.602-8.218-18.396-.32-1.564-.622-2.884-.672-2.935-.13-.13.105 2.231.528 5.319.44 3.211 1.377 7.856 2.387 11.829 7.814 30.743 30.05 55.749 60.15 67.646 8.668 3.424 17.415 5.582 26.932 6.64 3.576.4 13.699.56 17.43.276 17.117-1.296 32.02-6.334 47.308-15.996 1.362-.86 3.92-2.474 5.685-3.585a877.227 877.227 0 0 0 4.952-3.14c.958-.615 2.114-1.341 2.567-1.614a91.312 91.312 0 0 0 2.018-1.268c.656-.424 3.461-2.2 6.235-3.944l11.092-7.006 3.809-2.406.137-.086.42-.265.199-.126 2.804-1.771 9.69-6.121c12.348-7.759 16.03-10.483 21.766-16.102 2.392-2.342 5.997-6.34 6.176-6.848.037-.104.678-1.092 1.424-2.197 3.036-4.492 5.06-9.995 6.064-16.484.465-3.002.462-10.342-.005-13.663-.903-6.42-2.955-13.702-5.167-18.339-3.627-7.603-11.353-14.512-22.453-20.076-3.065-1.537-6.23-2.943-6.583-2.924-.168.009-10.497 6.322-22.954 14.03-12.457 7.71-23.268 14.4-24.025 14.87-.756.47-2.056 1.263-2.888 1.764l-7.128 4.42Z"
				fill="url(#b)"
			/>
		</svg>
	),
	duckduckgo: (
		<svg
			viewBox="0 0 128 128"
			className="size-4"
			xmlns="http://www.w3.org/2000/svg"
		>
			<circle cx="64" cy="64" r="64" fill="#DE5833" />
			<path
				d="M73 111.75c0-.5.123-.614-1.466-3.782-4.224-8.459-8.47-20.384-6.54-28.075.353-1.397-3.978-51.744-7.04-53.365-3.402-1.813-7.588-4.69-11.418-5.33-1.943-.31-4.49-.164-6.482.105-.353.047-.368.683-.03.798 1.308.443 2.895 1.212 3.83 2.375.178.22-.06.566-.342.577-.882.032-2.482.402-4.593 2.195-.244.207-.041.592.273.53 4.536-.897 9.17-.455 11.9 2.027.177.16.084.45-.147.512-23.694 6.44-19.003 27.05-12.696 52.344 5.619 22.53 7.733 29.792 8.4 32.004a.72.72 0 0 0 .423.467C55.228 118.38 73 118.524 73 113z"
				fill="#DDD"
			/>
			<path
				d="M122.75 64c0 32.447-26.303 58.75-58.75 58.75S5.25 96.447 5.25 64 31.553 5.25 64 5.25 122.75 31.553 122.75 64m-72.46 51.986c-1.624-5.016-6.161-19.551-10.643-37.92l-.447-1.828-.003-.016c-5.425-22.155-9.855-40.252 14.427-45.937.222-.052.33-.317.183-.492-2.786-3.305-8.005-4.388-14.604-2.111-.27.093-.506-.18-.338-.412 1.294-1.783 3.823-3.155 5.072-3.756.258-.124.242-.502-.031-.588a28 28 0 0 0-3.771-.9c-.37-.059-.404-.693-.032-.743 9.356-1.259 19.125 1.55 24.028 7.726a.33.33 0 0 0 .185.114c17.953 3.855 19.239 32.235 17.17 33.528-.407.255-1.714.108-3.438-.085-6.985-.781-20.818-2.329-9.401 18.948.113.21-.037.488-.272.525-6.416.997 1.755 21.034 7.812 34.323 23.815-5.52 41.563-26.868 41.563-52.362 0-29.685-24.065-53.75-53.75-53.75S10.25 34.315 10.25 64c0 24.947 16.995 45.924 40.04 51.986"
				fill="#fff"
			/>
			<path
				d="M84.28 90.698c-1.367-.633-6.621 3.135-10.11 6.028-.728-1.031-2.103-1.78-5.203-1.242-2.713.472-4.211 1.126-4.88 2.254-4.283-1.623-11.488-4.13-13.229-1.71-1.902 2.646.476 15.161 3.003 16.786 1.32.849 7.63-3.208 10.926-6.005.532.749 1.388 1.178 3.148 1.137 2.662-.062 6.979-.681 7.649-1.921q.06-.113.105-.266c3.388 1.266 9.35 2.606 10.682 2.406 3.47-.521-.484-16.723-2.09-17.467"
				fill="#3CA82B"
			/>
			<path
				d="M74.49 97.097c.144.256.26.526.358.8.483 1.352 1.27 5.648.674 6.709-.595 1.062-4.459 1.574-6.843 1.615s-2.92-.831-3.403-2.181c-.387-1.081-.577-3.621-.572-5.075-.098-2.158.69-2.916 4.334-3.506 2.696-.436 4.121.071 4.944.94 3.828-2.857 10.215-6.889 10.838-6.152 3.106 3.674 3.499 12.42 2.826 15.939-.22 1.151-10.505-1.139-10.505-2.38 0-5.152-1.337-6.565-2.65-6.71M51.96 95.488c.843-1.333 7.674.325 11.424 1.993 0 0-.77 3.491.456 7.604.359 1.203-8.627 6.558-9.8 5.637-1.355-1.065-3.85-12.432-2.08-15.234"
				fill="#4CBA3C"
			/>
			<path
				d="M55.269 68.407c.553-2.404 3.127-6.933 12.321-6.823 4.648-.019 10.422-.002 14.25-.436a51.312 51.312 0 0 0 12.726-3.095c3.98-1.519 5.392-1.18 5.887-.272.544.999-.097 2.722-1.488 4.309-2.656 3.03-7.431 5.38-15.865 6.076-8.433.698-14.02-1.565-16.425 2.118-1.038 1.589-.236 5.333 7.92 6.512 11.02 1.59 20.072-1.917 21.19.201s-5.323 6.428-16.362 6.518-17.934-3.865-20.379-5.83c-3.102-2.495-4.49-6.133-3.775-9.279"
				fill="#FC3"
			/>
			<g fill="#14307E" opacity=".8">
				<path d="M69.327 42.127c.616-1.008 1.981-1.786 4.216-1.786 2.234 0 3.285.889 4.013 1.88.148.202-.076.44-.306.34l-.168-.073c-.817-.357-1.82-.795-3.54-.82-1.838-.026-2.997.435-3.727.831-.246.134-.634-.133-.488-.372m-25.157 1.29c2.17-.907 3.876-.79 5.081-.504.254.06.43-.213.227-.377-.935-.755-3.03-1.692-5.76-.674-2.437.909-3.585 2.796-3.592 4.038-.002.292.6.317.756.07.42-.67 1.12-1.646 3.289-2.553" />
				<path d="M75.44 55.92a3.47 3.47 0 0 1-3.474-3.462 3.47 3.47 0 0 1 3.475-3.46 3.47 3.47 0 0 1 3.474 3.46 3.47 3.47 0 0 1-3.475 3.462m2.447-4.608a.899.899 0 0 0-1.799 0c0 .494.405.895.9.895.499 0 .9-.4.9-.895m-25.465 3.542a4.04 4.04 0 0 1-4.049 4.037 4.045 4.045 0 0 1-4.05-4.037 4.045 4.045 0 0 1 4.05-4.037 4.045 4.045 0 0 1 4.05 4.037m-1.193-1.338a1.05 1.05 0 0 0-2.097 0 1.048 1.048 0 0 0 2.097 0" />
			</g>
		</svg>
	),
	brave: (
		<svg
			viewBox="0 0 256 301"
			className="size-4"
			xmlns="http://www.w3.org/2000/svg"
		>
			<path
				d="M256,97.1 L246.7,72 L253.1,57.6 C253.9,55.7 253.5,53.6 252.1,52.1 L234.6,34.4 C226.9,26.7 215.5,24 205.2,27.6 L200.3,29.3 L173.5,0.3 L128.2,0 L127.9,0 L82.3,0.4 L55.6,29.6 L50.8,27.9 C40.4,24.2 28.9,26.9 21.2,34.8 L3.4,52.8 C2.2,54 1.9,55.7 2.5,57.2 L9.2,72.2 L0,97.3 L6,120 L33.2,223.3 C36.3,235.2 43.5,245.6 53.6,252.8 C53.6,252.8 86.6,276.1 119.1,297.2 C122,299.1 125,300.4 128.2,300.4 C131.4,300.4 134.4,299.1 137.3,297.2 C173.9,273.2 202.8,252.7 202.8,252.7 C212.8,245.5 220,235.1 223.1,223.2 L250.1,119.9 L256,97.1 Z"
				fill="#F15A22"
			/>
		</svg>
	),
	ecosia: (
		<svg
			role="img"
			viewBox="0 0 24 24"
			className="size-4"
			xmlns="http://www.w3.org/2000/svg"
		>
			<path
				d="M15.198 6.818H8.786v10.48h6.412v-3.342h-3.98v-1.262H13.8V11.42h-2.584v-1.261h3.981zM11.972.06A12.003 12.003 0 0 0 0 12.064a12.003 12.003 0 0 0 10.083 11.848c.068-1.277.196-2.723.434-3.652v-.014c0-.005 0-.007-.01-.012 0-.005-.01-.007-.012-.009 0-.002-.01-.002-.014-.002h-.356c-2.307 0-5.943-.333-6.916-3.45-1.458-4.642 2.025-6.314 3.484-4.97 0 .004.012.008.019.008.01 0 .014 0 .02-.005.01-.005.013-.009.015-.016v-.021c-.322-.945-2.148-6.867 2.64-8.496 4.08-1.369 8.07 1.491 7.461 5.265v.017c0 .007.01.012.012.014 0 .002.012.005.016.005 0 0 .012-.002.016-.005.298-.246 1.603-1.186 2.919-.148 1.247.982.844 3.73-1.627 5.003-.01.002-.014.007-.02.014v.023c0 .01.01.014.015.02.01.004.016.004.023.001 1.596-.239 4.316 1.193 2.11 4.375-1.447 2.1-4.71 2.365-6.168 2.365h-1.071s-.01 0-.012.002c0 .002-.01.005-.012.007 0 .002 0 .005-.01.009v.012c-.021.751.331 2.304.693 3.688A12.003 12.003 0 0 0 24 12.063 12.003 12.003 0 0 0 11.997.06a12.003 12.003 0 0 0-.03 0z"
				fill="currentColor"
			/>
		</svg>
	),
};

interface SettingsPanelProps {
	open: boolean;
	onClose: () => void;
}

function SettingRow({ children }: { children: React.ReactNode }) {
	return (
		<div className="flex min-h-[44px] items-center justify-between gap-3 border-border/50 border-b px-1 py-2.5 last:border-b-0">
			{children}
		</div>
	);
}

/**
 * A labelled slider laid out inline — label (and optional value) on the left,
 * the track filling the right half — matching the browser settings reference.
 */
function SliderRow({
	label,
	value,
	suffix = "",
	min,
	max,
	step = 1,
	onChange,
}: {
	label: string;
	value: number;
	suffix?: string;
	min: number;
	max: number;
	step?: number;
	onChange: (value: number) => void;
}) {
	return (
		<div className="flex min-h-[44px] items-center gap-4 border-border/50 border-b px-1 py-2.5 last:border-b-0">
			<div className="flex min-w-0 shrink-0 basis-[46%] flex-col">
				<span className="text-foreground text-sm">{label}</span>
				<span className="text-muted-foreground text-xs tabular-nums">
					{value}
					{suffix}
				</span>
			</div>
			<Slider
				min={min}
				max={max}
				step={step}
				value={[value]}
				onValueChange={(v) => onChange(v[0])}
				className="flex-1"
				aria-label={label}
			/>
		</div>
	);
}

/**
 * A labelled shadcn Select laid out inline — the unified dropdown control for
 * every discrete-choice setting in the sidebar (tile size, layout, max columns,
 * search engine, appearance). Flat styling, no glass.
 */
function SelectRow<T extends string>({
	label,
	value,
	options,
	onChange,
	triggerClassName = "min-w-[120px]",
}: {
	label: string;
	value: T;
	options: readonly { value: T; label: string }[];
	onChange: (value: T) => void;
	triggerClassName?: string;
}) {
	return (
		<SettingRow>
			<span className="text-foreground text-sm">{label}</span>
			<Select
				value={value}
				onValueChange={(v) => v && onChange(v as T)}
				items={options}
			>
				<SelectTrigger
					size="sm"
					className={triggerClassName}
					aria-label={label}
				>
					<SelectValue />
				</SelectTrigger>
				<SelectContent>
					{options.map((opt) => (
						<SelectItem key={opt.value} value={opt.value}>
							{opt.label}
						</SelectItem>
					))}
				</SelectContent>
			</Select>
		</SettingRow>
	);
}

/**
 * A labelled row of icon toggle buttons — an intuitive, wordless selector where
 * each option is represented by a glyph (used for the Card shape aspect ratio).
 * Radix/shadcn Button primitives, flat styling.
 */
function IconChoiceRow<T extends string>({
	label,
	value,
	options,
	onChange,
}: {
	label: string;
	value: T;
	options: readonly { value: T; icon: IconName; label: string }[];
	onChange: (value: T) => void;
}) {
	return (
		<SettingRow>
			<span className="text-foreground text-sm">{label}</span>
			<div className="flex gap-1">
				{options.map((opt) => (
					<Button
						key={opt.value}
						variant={value === opt.value ? "default" : "secondary"}
						size="icon-sm"
						onClick={() => onChange(opt.value)}
						aria-label={opt.label}
						aria-pressed={value === opt.value}
						title={opt.label}
					>
						<Icon name={opt.icon} size={16} />
					</Button>
				))}
			</div>
		</SettingRow>
	);
}

function SectionCard({
	title,
	children,
	className = "",
}: {
	title: string;
	children: React.ReactNode;
	className?: string;
}) {
	return (
		<div className="flex flex-col gap-4">
			<h3 className="left-1 m-0 px-3 font-medium text-muted-foreground text-sm">
				{title}
			</h3>
			<div
				className={`squircle relative mb-4 rounded-[3rem] border border-border/30 bg-card p-4 pb-3 shadow-sm first:mt-2 ${className}`}
			>
				{children}
			</div>
		</div>
	);
}

export function SettingsPanel({ open, onClose }: SettingsPanelProps) {
	const settings = useSetupStore((s) => s.settings);
	const updateSettings = useSetupStore((s) => s.updateSettings);
	const updateBackground = useSetupStore((s) => s.updateBackground);
	const updateClock = useSetupStore((s) => s.updateClock);
	const updateGreeting = useSetupStore((s) => s.updateGreeting);
	const updateSearch = useSetupStore((s) => s.updateSearch);
	const updateThumbnailCapture = useSetupStore((s) => s.updateThumbnailCapture);
	const resetAll = useSetupStore((s) => s.resetAll);
	const saveBackgroundImage = useImageStore((s) => s.saveBackgroundImage);

	const bgFileRef = useRef<HTMLInputElement>(null);
	const importFileRef = useRef<HTMLInputElement>(null);
	const [importStatus, setImportStatus] = useState("");
	const [confirmReset, setConfirmReset] = useState(false);

	async function handleReset() {
		await resetAll();
		setConfirmReset(false);
		setImportStatus("");
		onClose();
	}

	// === Background ===
	async function handleSolidColor(color: string) {
		updateBackground({ type: "solid", color } as Partial<
			Settings["background"]
		>);
	}
	async function handleGradient(id: string) {
		updateBackground({ type: "gradient", gradientId: id } as Partial<
			Settings["background"]
		>);
	}
	async function handleImageUpload(e: ChangeEvent<HTMLInputElement>) {
		const file = e.target.files?.[0];
		if (!file) return;
		const dataUrl = await fileToDataUrl(file);
		const imageId = await saveBackgroundImage(dataUrl);
		updateBackground({ type: "image", imageId } as Partial<
			Settings["background"]
		>);
	}

	// === Bookmarks ===
	async function handleImportBookmarks() {
		setImportStatus("Reading bookmarks…");
		try {
			const { foldersCreated, cardsCreated } = await importBrowserBookmarks();
			setImportStatus(
				`Done: ${foldersCreated} folder(s) and ${cardsCreated} link(s) imported.`,
			);
		} catch (err) {
			setImportStatus(
				err instanceof Error ? err.message : "Could not import bookmarks.",
			);
		}
	}

	// === Data ===
	async function handleExport() {
		await exportBackup();
	}
	async function handleImport(e: ChangeEvent<HTMLInputElement>) {
		const file = e.target.files?.[0];
		if (!file) return;
		try {
			await importBackup(await file.text());
			setImportStatus("Data imported successfully.");
		} catch {
			setImportStatus("Invalid file.");
		}
		e.target.value = "";
	}

	const bg = settings.background;
	const clock = settings.clock;
	const greeting = settings.greeting;
	const search = settings.search;

	return (
		<>
			<Sheet
				open={open}
				onOpenChange={(o) => {
					if (!o) onClose();
				}}
			>
				<SheetContent
					side="right"
					className="w-[380px] overflow-y-auto sm:w-[420px]"
				>
					<SheetHeader>
						<SheetTitle>Settings</SheetTitle>
					</SheetHeader>

					<div className="space-y-1 px-3 pb-8">
						{/* === General === */}
						<SectionCard title="General">
							<SelectRow
								label="Tile size"
								value={settings.tileSize}
								options={[
									{ value: "small", label: "Small" },
									{ value: "medium", label: "Medium" },
									{ value: "large", label: "Large" },
								]}
								onChange={(tileSize) => updateSettings({ tileSize })}
							/>

							<SelectRow
								label="Max columns"
								value={String(settings.maxColumns)}
								triggerClassName="min-w-[80px]"
								options={[4, 5, 6, 7, 8, 9, 10].map((n) => ({
									value: String(n),
									label: String(n),
								}))}
								onChange={(v) =>
									updateSettings({ maxColumns: Number.parseInt(v, 10) })
								}
							/>

							<SettingRow>
								<span className="text-foreground text-sm">Show title</span>
								<Switch
									checked={settings.showTitle}
									onCheckedChange={(v: boolean) =>
										updateSettings({ showTitle: v })
									}
								/>
							</SettingRow>

							<SettingRow>
								<span className="text-foreground text-sm">
									Show delete button
								</span>
								<Switch
									checked={settings.showDeleteButton}
									onCheckedChange={(v: boolean) =>
										updateSettings({ showDeleteButton: v })
									}
								/>
							</SettingRow>

							<SettingRow>
								<span className="text-foreground text-sm">Open in new tab</span>
								<Switch
									checked={settings.openInNewTab}
									onCheckedChange={(v: boolean) =>
										updateSettings({ openInNewTab: v })
									}
								/>
							</SettingRow>
						</SectionCard>

						{/* === Speed Dial === */}
						<SectionCard title="Speed Dial">
							<SelectRow
								label="Layout"
								value={settings.dialLayout}
								options={[
									{ value: "card", label: "Card" },
									{ value: "icon", label: "Icon" },
								]}
								onChange={(dialLayout) => updateSettings({ dialLayout })}
							/>

							{settings.dialLayout === "card" && (
								<IconChoiceRow
									label="Card shape"
									value={settings.cardAspect}
									options={[
										{ value: "square", icon: "square", label: "Square" },
										{
											value: "horizontal",
											icon: "rectangle-horizontal",
											label: "Landscape",
										},
										{
											value: "vertical",
											icon: "rectangle-vertical",
											label: "Portrait",
										},
									]}
									onChange={(cardAspect) => updateSettings({ cardAspect })}
								/>
							)}

							{settings.dialLayout === "icon" && (
								<SettingRow>
									<span className="text-foreground text-sm">Show titles</span>
									<Switch
										checked={settings.iconShowLabel}
										onCheckedChange={(v: boolean) =>
											updateSettings({ iconShowLabel: v })
										}
									/>
								</SettingRow>
							)}
						</SectionCard>

						{/* === Appearance === */}
						<SectionCard title="Appearance">
							<SettingRow>
								<div className="flex min-w-0 flex-col">
									<span className="text-foreground text-sm">Theme</span>
									<span className="text-muted-foreground text-xs">
										Liquid Glass or flat shadcn colors
									</span>
								</div>
								<Select
									value={settings.appearanceMode}
									onValueChange={(v) =>
										v &&
										updateSettings({
											appearanceMode: v as Settings["appearanceMode"],
										})
									}
								>
									<SelectTrigger
										size="sm"
										className="min-w-[130px]"
										aria-label="Theme"
									>
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="liquid">Liquid Glass</SelectItem>
										<SelectItem value="classic">Flat</SelectItem>
									</SelectContent>
								</Select>
							</SettingRow>
						</SectionCard>

						{/* === Background === */}
						<SectionCard title="Background">
							<div className="mt-2 grid grid-cols-4 gap-2">
								{GRADIENTS.map((g) => (
									<button
										key={g.id}
										className="flex aspect-[4/3] items-center justify-center rounded-2xl border-2 border-transparent bg-center bg-cover font-medium text-[10px] text-white/80 shadow-sm transition-transform hover:scale-[1.04]"
										style={{
											background: g.css,
											textShadow: "0 1px 3px rgba(0,0,0,0.5)",
										}}
										onClick={() => handleGradient(g.id)}
									>
										{g.label}
									</button>
								))}
								<button
									className="flex aspect-[4/3] cursor-pointer flex-col items-center justify-center gap-1 rounded-2xl border-2 border-border/60 border-dashed font-medium text-[10px] text-muted-foreground transition-transform hover:scale-[1.04]"
									style={{ backgroundColor: bg.color }}
									onClick={() => handleSolidColor(bg.color)}
								>
									<span>Color</span>
								</button>
								<label className="flex aspect-[4/3] cursor-pointer flex-col items-center justify-center gap-1 rounded-2xl border-2 border-border/60 border-dashed font-medium text-[10px] text-muted-foreground transition-transform hover:scale-[1.04]">
									<svg
										width="14"
										height="14"
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										strokeWidth="1.8"
									>
										<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" />
									</svg>
									Image
									<input
										ref={bgFileRef}
										type="file"
										accept="image/*"
										className="hidden"
										onChange={handleImageUpload}
									/>
								</label>
							</div>

							<div className="mt-3 flex items-center gap-2">
								<input
									type="color"
									value={bg.color}
									onChange={(e) => handleSolidColor(e.target.value)}
									className="h-[22px] w-[22px] cursor-pointer rounded-full border-2 border-border/30 bg-transparent p-0"
								/>
								<span className="text-muted-foreground text-xs">
									Custom color
								</span>
							</div>

							<SliderRow
								label="Opacity"
								value={bg.opacity}
								suffix="%"
								min={20}
								max={100}
								onChange={(v) =>
									updateBackground({
										opacity: v,
									} as Partial<Settings["background"]>)
								}
							/>
							<SliderRow
								label="Blur"
								value={bg.blur}
								suffix="px"
								min={0}
								max={20}
								onChange={(v) =>
									updateBackground({
										blur: v,
									} as Partial<Settings["background"]>)
								}
							/>
							<SliderRow
								label="Brightness"
								value={bg.brightness}
								suffix="%"
								min={40}
								max={140}
								onChange={(v) =>
									updateBackground({
										brightness: v,
									} as Partial<Settings["background"]>)
								}
							/>
						</SectionCard>

						{/* === Clock === */}
						<SectionCard title="Clock & Greeting">
							<SettingRow>
								<span className="text-foreground text-sm">Enable clock</span>
								<Switch
									checked={clock.enabled}
									onCheckedChange={(v: boolean) => updateClock({ enabled: v })}
								/>
							</SettingRow>
							<SettingRow>
								<span className="text-foreground text-sm">24-hour format</span>
								<Switch
									checked={clock.format24}
									onCheckedChange={(v: boolean) => updateClock({ format24: v })}
								/>
							</SettingRow>
							<SettingRow>
								<span className="text-foreground text-sm">Show seconds</span>
								<Switch
									checked={clock.showSeconds}
									onCheckedChange={(v: boolean) =>
										updateClock({ showSeconds: v })
									}
								/>
							</SettingRow>
							{clock.enabled && (
								<SliderRow
									label="Clock size"
									value={clock.size}
									suffix="%"
									min={60}
									max={200}
									step={5}
									onChange={(v) => updateClock({ size: v })}
								/>
							)}
							<SettingRow>
								<span className="text-foreground text-sm">Greeting</span>
								<Switch
									checked={greeting.enabled}
									onCheckedChange={(v: boolean) =>
										updateGreeting({ enabled: v })
									}
								/>
							</SettingRow>
							{greeting.enabled && (
								<div className="px-1 pt-1 pb-2">
									<Input
										placeholder="Your name"
										value={greeting.name}
										onChange={(e) => updateGreeting({ name: e.target.value })}
										className="rounded-xl border-border bg-secondary px-3 py-2 text-foreground text-sm"
									/>
								</div>
							)}
						</SectionCard>

						{/* === Search === */}
						<SectionCard title="Search">
							<SettingRow>
								<span className="text-foreground text-sm">Show search bar</span>
								<Switch
									checked={search.enabled}
									onCheckedChange={(v: boolean) => updateSearch({ enabled: v })}
								/>
							</SettingRow>
							{search.enabled && (
								<>
									<SettingRow>
										<span className="text-foreground text-sm">
											Search engine
										</span>
										<Select
											value={search.engine}
											onValueChange={(v) => v && updateSearch({ engine: v })}
										>
											<SelectTrigger
												size="sm"
												className="min-w-[120px]"
												aria-label="Search engine"
											>
												<span className="flex items-center gap-1.5">
													{ENGINE_ICONS[search.engine]}
													<SelectValue />
												</span>
											</SelectTrigger>
											<SelectContent>
												{SEARCH_ENGINES.map((engine) => (
													<SelectItem key={engine.id} value={engine.id}>
														<span className="flex items-center gap-2">
															{ENGINE_ICONS[engine.id]}
															{engine.label}
														</span>
													</SelectItem>
												))}
											</SelectContent>
										</Select>
									</SettingRow>

									<SelectRow
										label="Input icon"
										value={search.iconMode}
										options={[
											{ value: "search", label: "Magnifier" },
											{ value: "engine", label: "Engine logo" },
										]}
										onChange={(iconMode) => updateSearch({ iconMode })}
									/>

									<div className="px-1 pt-1 pb-2">
										<Input
											placeholder={`Buscar com "${
												(
													SEARCH_ENGINES.find((e) => e.id === search.engine) ??
													SEARCH_ENGINES[0]
												).label
											}"`}
											value={search.placeholder}
											onChange={(e) =>
												updateSearch({ placeholder: e.target.value })
											}
											className="rounded-xl border-border bg-secondary px-3 py-2 text-foreground text-sm"
										/>
										<p className="mt-1.5 px-1 text-muted-foreground text-xs">
											Custom placeholder — leave empty to name the engine
											automatically.
										</p>
									</div>
								</>
							)}
						</SectionCard>

						{/* === Bookmarks === */}
						<SectionCard title="Bookmarks">
							<SettingRow>
								<span className="text-foreground text-sm">
									Auto-capture thumbnails
								</span>
								<Switch
									checked={settings.thumbnailCapture.enabled}
									onCheckedChange={(v: boolean) =>
										updateThumbnailCapture({ enabled: v })
									}
								/>
							</SettingRow>
							<div className="px-1 pt-1">
								<Button
									variant="secondary"
									className="w-full rounded-xl text-sm"
									onClick={handleImportBookmarks}
								>
									Import bookmarks
								</Button>
								{importStatus && (
									<p className="mt-2 text-muted-foreground text-xs">
										{importStatus}
									</p>
								)}
							</div>
						</SectionCard>

						{/* === Data === */}
						<SectionCard title="Data">
							<div className="flex gap-2 px-1 pt-1">
								<Button
									variant="secondary"
									className="flex-1 rounded-xl text-sm"
									onClick={handleExport}
								>
									Export JSON
								</Button>
								<Button
									variant="secondary"
									className="flex-1 rounded-xl text-sm"
									onClick={() => importFileRef.current?.click()}
								>
									Import JSON
								</Button>
							</div>
							<input
								ref={importFileRef}
								type="file"
								accept="application/json"
								className="hidden"
								onChange={handleImport}
							/>
							<div className="px-1 pt-3 pb-1">
								<Button
									variant="ghost"
									className="w-full rounded-xl border border-red-500/30 text-red-500 text-sm hover:bg-red-500/10"
									onClick={() => setConfirmReset(true)}
								>
									Reset all
								</Button>
							</div>
						</SectionCard>
					</div>
				</SheetContent>
			</Sheet>

			<Dialog
				open={confirmReset}
				onOpenChange={(o) => {
					if (!o) setConfirmReset(false);
				}}
			>
				<DialogContent className="sm:max-w-[400px]">
					<DialogHeader>
						<DialogTitle>Reset everything?</DialogTitle>
						<DialogDescription>
							This permanently deletes all folders, links, thumbnails, and
							background images. This cannot be undone. Export a backup first if
							you want to keep your data.
						</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<Button variant="ghost" onClick={() => setConfirmReset(false)}>
							Cancel
						</Button>
						<Button
							className="border-red-500/30 bg-red-500/90 text-white hover:bg-red-500"
							onClick={handleReset}
						>
							Reset all
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</>
	);
}

function fileToDataUrl(file: File): Promise<string> {
	const { promise, resolve, reject } = Promise.withResolvers<string>();
	const reader = new FileReader();
	reader.onload = () => resolve(reader.result as string);
	reader.onerror = reject;
	reader.readAsDataURL(file);
	return promise;
}
