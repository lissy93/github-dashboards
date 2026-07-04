<script lang="ts">
	import {
		MapPin,
		Building2,
		Link as LinkIcon,
		Calendar,
		BookMarked,
		Star,
		Users,
		UserPlus,
		Activity
	} from '@lucide/svelte';
	import * as Card from '$lib/components/ui/card';
	import UserAvatar from '$lib/components/common/UserAvatar.svelte';
	import { Badge } from '$lib/components/ui/badge';
	import Icon from '$lib/components/common/Icon.svelte';
	import StatTile from '$lib/components/common/StatTile.svelte';
	import Hint from '$lib/components/common/Hint.svelte';
	import { compactNumber, formatDate, formatDateTime, safeHttpUrl } from '$lib/utils/format';
	import { GITHUB_WEB } from '$lib/config';
	import type { UserProfile } from '$lib/types';

	let { profile }: { profile: UserProfile } = $props();

	const meta = $derived(
		[
			profile.company && { icon: Building2, text: profile.company },
			profile.location && { icon: MapPin, text: profile.location },
			profile.websiteUrl && {
				icon: LinkIcon,
				text: profile.websiteUrl,
				href: safeHttpUrl(profile.websiteUrl) ?? undefined
			},
			{
				icon: Calendar,
				text: `Joined ${formatDate(profile.createdAt)}`,
				title: formatDateTime(profile.createdAt)
			}
		].filter(Boolean) as { icon: typeof MapPin; text: string; href?: string; title?: string }[]
	);

	const stats = $derived([
		{ label: 'Repos', value: compactNumber(profile.repoCount), icon: BookMarked },
		{ label: 'Stars', value: compactNumber(profile.totalStars), icon: Star },
		{ label: 'Followers', value: compactNumber(profile.followers), icon: Users },
		{ label: 'Following', value: compactNumber(profile.following), icon: UserPlus },
		{ label: 'Contributions', value: compactNumber(profile.contributionsLastYear), icon: Activity }
	]);
</script>

<Card.Root class="p-4 sm:p-5">
	<div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:gap-5">
		<div class="flex min-w-0 grow flex-col gap-3">
			<div class="flex items-start gap-4">
				<UserAvatar
					login={profile.login}
					src={profile.avatarUrl}
					class="size-16 rounded-md border sm:size-20"
					fallbackClass="rounded-md"
				/>
				<div class="min-w-0 space-y-1.5">
					<div class="flex flex-wrap items-center gap-2">
						<h1 class="truncate text-lg font-semibold">
							<a
								href="{GITHUB_WEB}/{profile.login}"
								target="_blank"
								rel="noreferrer"
								class="hover:underline"
							>
								{profile.name ?? profile.login}
							</a>
						</h1>
						<span class="text-muted-foreground text-sm">@{profile.login}</span>
						{#if profile.isOrg}<Badge variant="secondary">Org</Badge>{/if}
					</div>
					{#if profile.bio}
						<p class="text-muted-foreground max-w-prose text-sm">{profile.bio}</p>
					{/if}
				</div>
			</div>
			<div class="text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
				{#each meta as item (item.text)}
					<Hint text={item.title} class="gap-1.5">
						<Icon icon={item.icon} size={13} />
						{#if item.href}
							<a
								href={item.href}
								target="_blank"
								rel="noreferrer"
								class="hover:text-foreground truncate"
							>
								{item.text}
							</a>
						{:else}{item.text}{/if}
					</Hint>
				{/each}
			</div>
		</div>
		<div
			class="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:ml-auto lg:flex lg:max-w-md lg:shrink-0 lg:justify-end lg:gap-8"
		>
			{#each stats as stat (stat.label)}
				<StatTile label={stat.label} value={stat.value} icon={stat.icon} />
			{/each}
		</div>
	</div>
</Card.Root>
