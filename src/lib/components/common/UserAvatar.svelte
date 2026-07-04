<script lang="ts">
	import * as Avatar from '$lib/components/ui/avatar';

	// Avatar that falls back to the login's initials
	let {
		login,
		src,
		alt = login,
		size = 'default',
		class: className,
		fallbackClass
	}: {
		login: string;
		src: string;
		alt?: string;
		size?: 'default' | 'sm' | 'lg';
		class?: string;
		fallbackClass?: string;
	} = $props();
</script>

<Avatar.Root {size} class={className}>
	<Avatar.Image {src} {alt} />
	<Avatar.Fallback class={fallbackClass}>{login.slice(0, 2).toUpperCase()}</Avatar.Fallback>
</Avatar.Root>
