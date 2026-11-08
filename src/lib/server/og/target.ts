import { USER_PAGES, REPO_PAGES, type PageDef } from '$lib/config/pages';
import { LOGIN_RE, REPO_RE } from '$lib/utils/github-input';

// Who a card is for and the registry pages it shows, outermost first
export type OgTarget = { user: string; repo?: string; trail: PageDef[] };

// Registry pages named by the segments under a scope, null when they aren't a page
function findTrail(pages: PageDef[], [slug = '', childSlug, ...extra]: string[]): PageDef[] | null {
	const section = pages.find((page) => page.slug === slug);
	const child = section?.children?.find((page) => page.slug === childSlug);
	if (!section || extra.length || (childSlug !== undefined && !child)) return null;
	return child ? [section, child] : [section];
}

// Map a page path onto its scope and pages, user pages first then repo pages, like the router
export function resolveOgTarget(path: string): OgTarget | null {
	const [user, ...segments] = path.split('/');
	if (!LOGIN_RE.test(user)) return null;
	const userTrail = findTrail(USER_PAGES, segments);
	if (userTrail) return { user, trail: userTrail };
	const [repo = '', ...rest] = segments;
	const repoTrail = REPO_RE.test(repo) ? findTrail(REPO_PAGES, rest) : null;
	return repoTrail && { user, repo, trail: repoTrail };
}
