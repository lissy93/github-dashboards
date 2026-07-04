import type { ActivityType } from '$lib/types';

// Community types excluded when the repo feed is set to core-only mode
export const COMMUNITY_TYPES: ActivityType[] = ['star', 'fork', 'public', 'sponsor'];
export const COMMUNITY_EXCLUDE = COMMUNITY_TYPES.join(',');
