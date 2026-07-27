// Favicon URLs for referrer domains via icon.horse, so the top-referrers list shows site logos

// GitHub reports some referrers by brand name rather than domain, map the common ones
const BRAND_DOMAINS: Record<string, string> = {
	google: 'google.com',
	bing: 'bing.com',
	duckduckgo: 'duckduckgo.com',
	yahoo: 'yahoo.com',
	yandex: 'yandex.com',
	baidu: 'baidu.com',
	ecosia: 'ecosia.org'
};

// Resolve a referrer label to a bare domain, or undefined when it is not a site
export function referrerDomain(referrer: string): string | undefined {
	const name = referrer.trim().toLowerCase();
	if (BRAND_DOMAINS[name]) return BRAND_DOMAINS[name];
	return /^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(name) ? name : undefined;
}

// icon.horse favicon for a referrer, undefined when it maps to no domain
export function faviconUrl(referrer: string): string | undefined {
	const domain = referrerDomain(referrer);
	return domain ? `https://icon.horse/icon/${domain}` : undefined;
}
