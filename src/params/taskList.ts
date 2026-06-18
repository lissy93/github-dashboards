import type { ParamMatcher } from '@sveltejs/kit';
import { BUCKET_BY_SECTION } from '$lib/components/tasks/tasks-config';

// Only the four known task list sections route, anything else 404s
export const match: ParamMatcher = (param) => param in BUCKET_BY_SECTION;
