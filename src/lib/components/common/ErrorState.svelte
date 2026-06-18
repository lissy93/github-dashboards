<script lang="ts">
	import { TriangleAlert } from '@lucide/svelte';
	import Icon from '$lib/components/common/Icon.svelte';
	import type { DisplayError } from '$lib/errors';

	let { error }: { error: DisplayError } = $props();
</script>

<div class="mx-auto max-w-md space-y-3 py-20 text-center">
	<Icon icon={TriangleAlert} size={28} class="text-warning mx-auto" />
	<h1 class="text-lg font-medium capitalize">{error.title}</h1>
	<p class="text-muted-foreground text-sm">{error.message}</p>
</div>
