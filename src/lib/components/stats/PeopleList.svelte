<script lang="ts">
	import UserAvatar from '$lib/components/common/UserAvatar.svelte';
	import Hint from '$lib/components/common/Hint.svelte';
	import { paths } from '$lib/config';

	// Each row links to the person, the optional tip carries extra context on hover
	type Row = { login: string; name?: string | null; avatarUrl: string; tip?: string };
	let { people }: { people: Row[] } = $props();
</script>

<ul class="flex flex-col gap-1">
	{#each people as person (person.login)}
		<li>
			<Hint text={person.tip} class="block w-full">
				<a
					href={paths.user(person.login)}
					class="hover:bg-muted/60 flex items-center gap-2.5 rounded-md px-1.5 py-1 transition-colors"
				>
					<UserAvatar login={person.login} src={person.avatarUrl} size="sm" />
					<span class="flex min-w-0 flex-1 items-baseline gap-1.5">
						<span class="truncate text-sm font-medium">{person.name || person.login}</span>
						{#if person.name}
							<span class="text-muted-foreground truncate text-xs">{person.login}</span>
						{/if}
					</span>
				</a>
			</Hint>
		</li>
	{/each}
</ul>
