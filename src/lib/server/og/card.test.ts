import { describe, it, expect } from 'vitest';
import { cleanText, defaultCard, pageCard, type OgNode } from './card';

// Every node in a card tree, depth first, so tests check what actually renders
function nodes(node: OgNode | string): (OgNode | string)[] {
	if (typeof node === 'string') return [node];
	return [node, ...((node.props.children ?? []) as (OgNode | string)[]).flatMap(nodes)];
}

const texts = (card: OgNode) => nodes(card).filter((node) => typeof node === 'string');
const dots = (card: OgNode) =>
	nodes(card).filter((node) => typeof node !== 'string' && node.type === 'circle').length;

describe('cleanText', () => {
	it('drops emoji, flags, keycaps and joined sequences', () => {
		expect(cleanText('🚀 Fast ✨ flag 🇬🇧 key 1️⃣ family 👨‍👩‍👧 done')).toBe('Fast flag key family done');
	});

	it('keeps accented latin and punctuation, drops scripts the font lacks', () => {
		expect(cleanText('Café Ünïcödé, a/b (c) 你好 日本')).toBe('Café Ünïcödé, a/b (c)');
	});

	it('returns empty for missing or undrawable text so callers can fall back', () => {
		expect(cleanText(null)).toBe('');
		expect(cleanText('日本語のみ 🎉')).toBe('');
	});
});

describe('cards', () => {
	it('draws the full robot from the site logo', () => {
		expect(dots(defaultCard())).toBe(441);
	});

	it('shows the repo identity, page trail and stats', () => {
		const text = texts(
			pageCard({
				trail: ['Info', 'Stats'],
				owner: 'octocat',
				name: 'hello-world',
				description: 'My first repo',
				avatar: null,
				stats: [{ label: 'Stars', value: '1.2K' }]
			})
		);
		expect(text).toEqual(
			expect.arrayContaining(['octocat /', 'hello-world', 'My first repo', 'Info / Stats', '1.2K'])
		);
	});

	it('leaves out the stat row and avatar when nothing is cached', () => {
		const card = pageCard({
			trail: ['Overview'],
			name: 'octocat',
			description: 'Profile summary',
			avatar: null,
			stats: []
		});
		expect(JSON.stringify(card)).not.toContain('"img"');
		expect(texts(card)).not.toContain('Stars');
	});
});
