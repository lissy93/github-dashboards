import type { Component } from 'svelte';
import { CircleCheck, CircleX, CircleDashed } from '@lucide/svelte';

type Glyph = { icon: Component<{ size?: number | string; class?: string }>; color: string };

// Icon and colour for a run or deployment status token, shared across the CI/CD tables
export const STATUS_GLYPH: Record<'success' | 'danger' | 'warning' | 'muted', Glyph> = {
	success: { icon: CircleCheck, color: 'text-success' },
	danger: { icon: CircleX, color: 'text-danger' },
	warning: { icon: CircleDashed, color: 'text-warning' },
	muted: { icon: CircleDashed, color: 'text-muted-foreground' }
};
