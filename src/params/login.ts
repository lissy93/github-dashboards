import type { ParamMatcher } from '@sveltejs/kit';

// GitHub login: 1-39 chars, alphanumeric with non-repeating, non-edge hyphens
const LOGIN = /^[a-zA-Z\d](?:[a-zA-Z\d]|-(?=[a-zA-Z\d])){0,38}$/;

export const match: ParamMatcher = (param) => LOGIN.test(param);
