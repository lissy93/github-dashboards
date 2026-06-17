<script lang="ts">
	import { onMount } from 'svelte';
	import { Sun, Moon } from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button';
	import Icon from '$lib/components/common/Icon.svelte';

	let isDark = $state(true);

	onMount(() => {
		isDark = document.documentElement.classList.contains('dark');
	});

	// Flip the theme class and remember the choice
	function toggle() {
		isDark = !isDark;
		document.documentElement.classList.toggle('dark', isDark);
		localStorage.setItem('theme', isDark ? 'dark' : 'light');
	}
</script>

<Button variant="ghost" size="icon" class="size-9" aria-label="Toggle theme" onclick={toggle}>
	<Icon icon={isDark ? Moon : Sun} />
</Button>
