import logoSource from '$lib/components/common/Logo.svelte?raw';
import { APP_NAME, APP_DESCRIPTION, OG_SIZE } from '$lib/config';

type Style = Record<string, string | number>;
type Child = OgNode | string | null | undefined | false;
export type OgNode = { type: string; props: Record<string, unknown> };

export type OgStat = { label: string; value: string; color?: string | null };

// Everything a page card shows, owner set means a repo card
export type OgView = {
	trail: string[];
	owner?: string;
	name: string;
	subtitle?: string | null;
	description: string;
	avatar: string | null;
	stats: OgStat[];
};

// Dark theme tokens from layout.css, satori converts the oklch for the rasteriser
const COLOR = {
	background: 'oklch(0.17 0.005 264)',
	foreground: 'oklch(0.96 0.003 264)',
	muted: 'oklch(0.255 0.006 264)',
	mutedForeground: 'oklch(0.68 0.012 264)',
	primary: 'oklch(0.68 0.13 248)',
	border: 'oklch(1 0 0 / 9%)',
	grid: 'oklch(1 0 0 / 7%)'
};

const PAD = 64;
const CONTENT_WIDTH = OG_SIZE.width - PAD * 2;
const CHAR_WIDTH = 0.6;
const USER_AVATAR = 200;
const USER_GAP = 48;
const FEATURES = ['Stats', 'Activity', 'CI/CD', 'Security'];

// The robot dots straight from the site logo, recoloured with the same tokens
const ROBOT_FILL: Record<string, string> = {
	shell: COLOR.foreground,
	screen: COLOR.muted,
	dark: COLOR.mutedForeground,
	accent: COLOR.primary
};
const ROBOT_DOTS = [...logoSource.matchAll(/x="(\d+)" y="(\d+)" fill="var\(--robot-(\w+)\)"/g)].map(
	([, cx, cy, part]) => ({ type: 'circle', props: { cx, cy, r: 3.2, fill: ROBOT_FILL[part] } })
);

// Tiny element builder in the shape satori reads
const el = (type: string, style: Style, ...children: Child[]): OgNode => ({
	type,
	props: { style, children: children.filter(Boolean) }
});

const robot = (height: number): OgNode => ({
	type: 'svg',
	props: {
		viewBox: '0 0 248 232',
		width: Math.round((height * 248) / 232),
		height,
		children: ROBOT_DOTS
	}
});

const avatarImage = (src: string, size: number, radius: number): OgNode => ({
	type: 'img',
	props: { src, width: size, height: size, style: { borderRadius: radius } }
});

// Biggest font that fits a mono string on one line, wrapping below the floor
function fitSize(text: string, width: number, max: number, min = 48): number {
	return Math.max(min, Math.min(max, Math.floor(width / (text.length * CHAR_WIDTH))));
}

// Emoji and scripts Geist Mono can't draw, which would otherwise render as tofu
const UNDRAWABLE =
	/\p{RGI_Emoji}|\p{Extended_Pictographic}|[^\p{Script=Latin}\p{Script=Common}\p{Script=Inherited}]/gv;

export function cleanText(text: string | null | undefined): string {
	return (text ?? '').replace(UNDRAWABLE, '').replace(/\s+/g, ' ').trim();
}

const pill = (text: string) =>
	el(
		'div',
		{
			display: 'flex',
			padding: '8px 18px',
			border: `2px solid ${COLOR.border}`,
			borderRadius: 999,
			color: COLOR.primary,
			fontSize: 22,
			textTransform: 'uppercase',
			letterSpacing: 2
		},
		text
	);

// Muted copy that ellipses after a few lines
const clamp = (text: string, fontSize: number, lines: number) =>
	el(
		'div',
		{
			display: 'block',
			width: '100%',
			fontSize,
			lineHeight: 1.4,
			color: COLOR.mutedForeground,
			lineClamp: lines
		},
		text
	);

const headline = (text: string, fontSize: number) =>
	el(
		'div',
		{ fontSize, fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1, wordBreak: 'break-all' },
		text
	);

// One big number over its label, with an optional colour dot
const stat = ({ label, value, color }: OgStat) =>
	el(
		'div',
		{ display: 'flex', flexDirection: 'column', gap: 4 },
		el(
			'div',
			{ display: 'flex', alignItems: 'center', gap: 14, fontSize: 44, fontWeight: 800 },
			color && el('div', { width: 22, height: 22, borderRadius: 999, backgroundColor: color }),
			value
		),
		el(
			'div',
			{ fontSize: 20, color: COLOR.mutedForeground, textTransform: 'uppercase', letterSpacing: 2 },
			label
		)
	);

// Dot grid canvas with the primary bar along the bottom, shared by every card
const frame = (...children: Child[]) =>
	el(
		'div',
		{
			width: '100%',
			height: '100%',
			boxSizing: 'border-box',
			display: 'flex',
			flexDirection: 'column',
			padding: `56px ${PAD}px ${PAD}px`,
			backgroundColor: COLOR.background,
			backgroundImage: `radial-gradient(circle at 50% 50%, ${COLOR.grid} 10%, transparent 12%)`,
			backgroundSize: '28px 28px',
			color: COLOR.foreground,
			fontFamily: 'Geist Mono',
			fontSize: 28
		},
		...children,
		el('div', {
			position: 'absolute',
			left: 0,
			right: 0,
			bottom: 0,
			height: 10,
			backgroundColor: COLOR.primary
		})
	);

// Site-wide card for the homepage and anything without its own
export function defaultCard(): OgNode {
	const [first, second] = APP_NAME.split('-');
	return frame(
		el(
			'div',
			{ display: 'flex', flexGrow: 1, alignItems: 'center', justifyContent: 'space-between' },
			el(
				'div',
				{ display: 'flex', flexDirection: 'column', gap: 28, width: 640 },
				el(
					'div',
					{
						display: 'flex',
						flexDirection: 'column',
						fontSize: 104,
						fontWeight: 800,
						letterSpacing: '-0.04em',
						lineHeight: 0.95
					},
					el('div', { color: COLOR.mutedForeground }, `${first}-`),
					el('div', {}, second)
				),
				el('div', { width: 120, height: 10, backgroundColor: COLOR.primary }),
				clamp(APP_DESCRIPTION, 34, 3),
				el('div', { display: 'flex', gap: 12 }, ...FEATURES.map(pill))
			),
			robot(380)
		)
	);
}

// A user or repo card, brand and page up top, identity in the middle, stats along the bottom
export function pageCard(view: OgView): OgNode {
	const identity = view.owner
		? el(
				'div',
				{ display: 'flex', flexDirection: 'column', gap: 20 },
				el(
					'div',
					{
						display: 'flex',
						alignItems: 'center',
						gap: 20,
						fontSize: 36,
						color: COLOR.mutedForeground
					},
					view.avatar && avatarImage(view.avatar, 56, 12),
					`${view.owner} /`
				),
				headline(view.name, fitSize(view.name, CONTENT_WIDTH, 96)),
				clamp(view.description, 30, 2)
			)
		: el(
				'div',
				{ display: 'flex', alignItems: 'center', gap: USER_GAP },
				view.avatar && avatarImage(view.avatar, USER_AVATAR, 28),
				el(
					'div',
					{ display: 'flex', flexDirection: 'column', gap: 12, flex: 1 },
					headline(
						view.name,
						fitSize(view.name, CONTENT_WIDTH - (view.avatar ? USER_AVATAR + USER_GAP : 0), 96)
					),
					view.subtitle &&
						el('div', { fontSize: 36, lineClamp: 1, display: 'block' }, view.subtitle),
					clamp(view.description, 28, 2)
				)
			);

	return frame(
		el(
			'div',
			{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
			el(
				'div',
				{ display: 'flex', alignItems: 'center', gap: 16, fontWeight: 600 },
				robot(44),
				APP_NAME
			),
			pill(view.trail.join(' / '))
		),
		el(
			'div',
			{ display: 'flex', flexDirection: 'column', flexGrow: 1, justifyContent: 'center' },
			identity
		),
		view.stats.length > 0 && el('div', { display: 'flex', gap: 64 }, ...view.stats.map(stat))
	);
}
