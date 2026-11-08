<script lang="ts">
	import { untrack } from 'svelte';
	import { navigating } from '$app/state';
	import { loading } from '$lib/state/loading.svelte';

	// Creep toward a ceiling while work is pending, then snap to full and fade out
	const START = 8;
	const CEILING = 92;
	const TRICKLE_MS = 400;
	const HOLD_MS = 250;
	const FADE_MS = 300;

	let progress = $state(0);
	let shown = $state(false);

	// Page navigations and any in-flight panel fetch both count as loading
	const active = $derived(!!navigating.to || loading.active);

	// untrack so the trickle's own writes to progress/shown never re-run this effect
	$effect(() => (active ? untrack(start) : untrack(finish)));

	function start() {
		shown = true;
		if (progress === 0 || progress >= CEILING) progress = START;
		const trickle = setInterval(() => {
			const remaining = CEILING - progress;
			if (remaining > 0) progress += Math.max(0.5, remaining * 0.12);
		}, TRICKLE_MS);
		return () => clearInterval(trickle);
	}

	function finish() {
		if (!shown) return;
		progress = 100;
		const hide = setTimeout(() => (shown = false), HOLD_MS);
		const reset = setTimeout(() => (progress = 0), HOLD_MS + FADE_MS);
		return () => {
			clearTimeout(hide);
			clearTimeout(reset);
		};
	}
</script>

<div
	class="pointer-events-none fixed inset-x-0 top-0 z-50 h-0.5 transition-opacity duration-300"
	class:opacity-0={!shown}
	aria-hidden="true"
>
	<div
		class="h-full bg-primary transition-[width] duration-300 ease-out motion-reduce:transition-none"
		style:width="{progress}%"
		style:box-shadow="0 0 8px 0 var(--primary)"
	></div>
</div>
