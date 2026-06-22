import type { ParamMatcher } from '@sveltejs/kit';

// GitHub repo name: up to 100 chars of word chars, dot and hyphen, never . or ..
const REPO = /^(?!\.{1,2}$)[\w.-]{1,100}$/;

export const match: ParamMatcher = (param) => REPO.test(param);
