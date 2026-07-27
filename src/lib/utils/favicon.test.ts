import { describe, expect, it } from 'vitest';
import { faviconUrl, referrerDomain } from '$lib/utils/favicon';

describe('referrerDomain', () => {
	it('passes through a bare domain, case-insensitively', () => {
		expect(referrerDomain('GitHub.com')).toBe('github.com');
		expect(referrerDomain('news.ycombinator.com')).toBe('news.ycombinator.com');
		expect(referrerDomain('t.co')).toBe('t.co');
	});

	it('maps GitHub brand referrers to their domain', () => {
		expect(referrerDomain('Google')).toBe('google.com');
		expect(referrerDomain('DuckDuckGo')).toBe('duckduckgo.com');
	});

	it('returns undefined for labels that are not a site', () => {
		expect(referrerDomain('Direct')).toBeUndefined();
		expect(referrerDomain('some referrer')).toBeUndefined();
	});
});

describe('faviconUrl', () => {
	it('builds an icon.horse url for a resolvable referrer', () => {
		expect(faviconUrl('Bing')).toBe('https://icon.horse/icon/bing.com');
		expect(faviconUrl('reddit.com')).toBe('https://icon.horse/icon/reddit.com');
	});

	it('is undefined when the referrer maps to no domain', () => {
		expect(faviconUrl('Direct')).toBeUndefined();
	});
});
