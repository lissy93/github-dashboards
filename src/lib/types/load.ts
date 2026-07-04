import type { DisplayError } from '$lib/utils/errors';

// A settled load, errors travel as data so their message survives streaming
export type LoadResult<T> = { ok: true; data: T } | { ok: false; error: DisplayError };
