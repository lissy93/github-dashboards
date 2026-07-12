import type { ParamMatcher } from '@sveltejs/kit';
import { LOGIN_RE } from '$lib/utils/github-input';

export const match: ParamMatcher = (param) => LOGIN_RE.test(param);
