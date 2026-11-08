import satori, { type Font } from 'satori';
import { Resvg } from '@resvg/resvg-js';
import { read } from '$app/server';
import { OG_SIZE } from '$lib/config';
import regular from '@fontsource/geist-mono/files/geist-mono-latin-400-normal.woff';
import regularExt from '@fontsource/geist-mono/files/geist-mono-latin-ext-400-normal.woff';
import semibold from '@fontsource/geist-mono/files/geist-mono-latin-600-normal.woff';
import semiboldExt from '@fontsource/geist-mono/files/geist-mono-latin-ext-600-normal.woff';
import extrabold from '@fontsource/geist-mono/files/geist-mono-latin-800-normal.woff';
import extraboldExt from '@fontsource/geist-mono/files/geist-mono-latin-ext-800-normal.woff';
import type { OgNode } from './card';

// Static Geist Mono cuts, satori can't read the variable woff2 the site uses
const FONT_FILES = [
	[400, regular],
	[400, regularExt],
	[600, semibold],
	[600, semiboldExt],
	[800, extrabold],
	[800, extraboldExt]
] as const;

let fonts: Promise<Font[]> | undefined;

// Read the font files once per server instance
function loadFonts(): Promise<Font[]> {
	fonts ??= Promise.all(
		FONT_FILES.map(async ([weight, file]) => ({
			name: 'Geist Mono',
			weight,
			style: 'normal' as const,
			data: await read(file).arrayBuffer()
		}))
	);
	return fonts;
}

// Lay a card out with satori, then rasterise it to a png response
export async function renderOg(card: OgNode, cacheControl: string): Promise<Response> {
	const svg = await satori(card, { ...OG_SIZE, fonts: await loadFonts() });
	const png = new Resvg(svg, { font: { loadSystemFonts: false } }).render().asPng();
	return new Response(new Uint8Array(png), {
		headers: { 'content-type': 'image/png', 'cache-control': cacheControl }
	});
}
