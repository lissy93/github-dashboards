<script lang="ts">
	import * as Tooltip from '$lib/components/ui/tooltip';
	import { REACTIONS } from '$lib/config/reactions';
	import type { ActivityEvent } from '$lib/types';

	let { event }: { event: ActivityEvent } = $props();

	const reactions = $derived(event.reactions ?? {});
	const number = $derived((event.payload as { number?: number } | null)?.number);
	// The reactions endpoint keys off an issue/PR number, so users load only for those
	const canLoadUsers = $derived(
		(event.type === 'pr' || event.type === 'issue') && typeof number === 'number'
	);

	type Loaded = { loading: boolean; users: string[] | null; failed: boolean };
	let usersByKey = $state<Record<string, Loaded>>({});

	// Fetch reactors when a tooltip opens, once per reaction unless a past attempt failed
	async function loadUsers(key: string) {
		if (!canLoadUsers || number == null) return;
		const current = usersByKey[key];
		if (current?.loading || current?.users) return;
		usersByKey[key] = { loading: true, users: null, failed: false };
		try {
			const query = new URLSearchParams({ repo: event.repo, number: String(number), content: key });
			const res = await fetch(`/api/reactions?${query}`);
			if (!res.ok) throw new Error(`reactions ${res.status}`);
			usersByKey[key] = { loading: false, users: (await res.json()) as string[], failed: false };
		} catch {
			usersByKey[key] = { loading: false, users: null, failed: true };
		}
	}

	// Comma-separated logins, noting any reactors beyond the fetched cap
	function userList(logins: string[], total: number): string {
		const extra = total - logins.length;
		return extra > 0 ? `${logins.join(', ')} +${extra} more` : logins.join(', ');
	}
</script>

<Tooltip.Provider delayDuration={150} disableHoverableContent>
	<div class="flex flex-wrap items-center justify-end gap-1 text-xs text-muted-foreground">
		{#each Object.entries(reactions) as [key, count] (key)}
			<Tooltip.Root onOpenChange={(open) => open && loadUsers(key)}>
				<Tooltip.Trigger
					class="inline-flex items-center gap-0.5 rounded-full bg-muted px-1.5 py-0.5 tabular-nums focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
				>
					<span aria-hidden="true">{REACTIONS[key].emoji}</span>
					{count}
				</Tooltip.Trigger>
				<Tooltip.Content>
					<div class="flex flex-col items-start gap-0.5">
						<span class="font-medium">{REACTIONS[key].label} · {count}</span>
						{#if canLoadUsers}
							{@const state = usersByKey[key]}
							{#if state?.loading}
								<span class="text-muted-foreground">Loading…</span>
							{:else if state?.failed}
								<span class="text-muted-foreground">Could not load users</span>
							{:else if state?.users?.length}
								<span class="text-muted-foreground">{userList(state.users, count)}</span>
							{/if}
						{/if}
					</div>
				</Tooltip.Content>
			</Tooltip.Root>
		{/each}
	</div>
</Tooltip.Provider>
