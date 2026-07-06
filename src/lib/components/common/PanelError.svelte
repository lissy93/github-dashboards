<script lang="ts">
	import { Timer, Lock, LogIn, SearchX, ServerCrash, Unplug } from '@lucide/svelte';
	import Icon from '$lib/components/common/Icon.svelte';
	import { panelCause, STATUS_CAUSES, LEVEL_META } from '$lib/config/status';
	import type { DisplayError } from '$lib/utils/errors';
	import type { StatusCause } from '$lib/types';

	// Friendly stand-in for a failed panel, hiding the raw error behind a details toggle
	let { error }: { error: DisplayError } = $props();

	const ICONS: Partial<Record<StatusCause, typeof Unplug>> = {
		rate_limited: Timer,
		forbidden: Lock,
		needs_auth: LogIn,
		not_found: SearchX,
		unavailable: ServerCrash
	};

	const cause = $derived(panelCause({ error }));
	const meta = $derived(STATUS_CAUSES[cause]);
</script>

<div class="flex flex-col items-center gap-2 px-4 py-6 text-center">
	<div class="bg-muted/60 flex size-10 items-center justify-center rounded-full">
		<Icon icon={ICONS[cause] ?? Unplug} size={18} class={LEVEL_META[meta.level].color} />
	</div>
	<p class="text-sm font-medium">{meta.label}</p>
	<p class="text-muted-foreground/80 max-w-[32ch] text-xs">{meta.hint}</p>
	<details class="mt-1 w-full max-w-sm">
		<summary class="text-muted-foreground hover:text-foreground cursor-pointer text-xs select-none">
			Show details
		</summary>
		<p
			class="text-muted-foreground bg-muted/40 mt-2 max-h-32 overflow-auto rounded-md border p-2 text-left font-mono text-xs break-words"
		>
			{error.message}
		</p>
	</details>
</div>
