<script lang="ts">
	import * as Avatar from '$lib/components/ui/avatar';
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
					<Avatar.Root size="sm">
						<Avatar.Image src={person.avatarUrl} alt={person.login} />
						<Avatar.Fallback>{person.login.slice(0, 2).toUpperCase()}</Avatar.Fallback>
					</Avatar.Root>
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
