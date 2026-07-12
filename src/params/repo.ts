import type { ParamMatcher } from '@sveltejs/kit';
import { REPO_RE } from '$lib/utils/github-input';

export const match: ParamMatcher = (param) => REPO_RE.test(param);
