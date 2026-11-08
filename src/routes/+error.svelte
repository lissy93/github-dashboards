<script lang="ts">
	import { TriangleAlert } from '@lucide/svelte';
	import { page } from '$app/state';
	import { Button } from '$lib/components/ui/button';
	import Icon from '$lib/components/common/Icon.svelte';
	import { reverify } from '$lib/state/challenge';

	// A bare 403 or 429 is the firewall's bot check, ours always have a message
	$effect(() => {
		const bare = page.error?.message === `Error: ${page.status}`;
		if (bare && (page.status === 403 || page.status === 429)) reverify();
	});
</script>

<section class="mx-auto max-w-md space-y-4 py-20 text-center">
	<Icon icon={TriangleAlert} size={32} class="mx-auto text-warning" />
	<div class="space-y-1">
		<h1 class="text-2xl font-semibold">{page.status}</h1>
		<p class="text-muted-foreground">{page.error?.message ?? 'Something went wrong'}</p>
	</div>
	<Button href="/" variant="outline">Back home</Button>
</section>
