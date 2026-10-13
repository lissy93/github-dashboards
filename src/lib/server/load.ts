import { logError, toDisplayError, type DisplayError } from '$lib/utils/errors';
import type { LoadResult } from '$lib/types';

// Panels give up here, under Vercel's 30s cap, while the fetch runs on into the cache
const SETTLE_TIMEOUT_MS = 25000;
// How long a page waits on its datasets before streaming the rest, tighter on a click
const INLINE_BUDGET_MS = 500;
const NAV_INLINE_BUDGET_MS = 150;

const overBudget = Symbol('over budget');
type Inlined<V> = V extends Promise<infer U> ? U | Promise<U> : V;

const stillLoading: DisplayError = {
	title: 'still loading',
	message: 'Taking longer than usual, still fetching in the background. Check back shortly',
	code: 'pending',
	pending: true
};

// Wrap a fetch as a LoadResult, so one duff dataset doesn't blank the others.
// A slow task settles as a soft pending result at the timeout instead of holding
// its panel on a skeleton forever
export function settle<T>(
	scope: string,
	task: Promise<T>,
	timeoutMs = SETTLE_TIMEOUT_MS
): Promise<LoadResult<T>> {
	const settled = task
		.then((data) => ({ ok: true as const, data }))
		.catch((caught) => {
			logError(scope, caught);
			return { ok: false as const, error: toDisplayError(caught) };
		});
	let timer: ReturnType<typeof setTimeout> | undefined;
	const timeout = new Promise<LoadResult<T>>((resolve) => {
		timer = setTimeout(() => resolve({ ok: false, error: stillLoading }), timeoutMs);
	});
	return Promise.race([settled, timeout]).finally(() => clearTimeout(timer));
}

// Inline whatever lands within the budget and stream the rest, so a slow dataset never holds the page
export async function inlineReady<T extends Record<string, unknown>>(
	data: T,
	isDataRequest: boolean
): Promise<{ [K in keyof T]: Inlined<T[K]> }> {
	let timer: ReturnType<typeof setTimeout> | undefined;
	const deadline = new Promise<typeof overBudget>((resolve) => {
		timer = setTimeout(
			() => resolve(overBudget),
			isDataRequest ? NAV_INLINE_BUDGET_MS : INLINE_BUDGET_MS
		);
	});
	const entries = await Promise.all(
		Object.entries(data).map(async ([key, value]) => {
			if (!(value instanceof Promise)) return [key, value];
			const landed = await Promise.race([value, deadline]);
			return [key, landed === overBudget ? value : landed];
		})
	);
	clearTimeout(timer);
	return Object.fromEntries(entries) as { [K in keyof T]: Inlined<T[K]> };
}
