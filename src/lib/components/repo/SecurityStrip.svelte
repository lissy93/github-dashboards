<script lang="ts">
	import {
		Bug,
		ListChecks,
		Megaphone,
		ShieldAlert,
		ShieldCheck,
		TriangleAlert
	} from '@lucide/svelte';
	import StatTileGrid from '$lib/components/common/StatTileGrid.svelte';
	import type { Tile } from '$lib/components/common/StatTileGrid.svelte';
	import { GRADE_COLOR } from '$lib/views/security';
	import type { RepoSecurity } from '$lib/types';

	let { security }: { security: RepoSecurity } = $props();

	// Alert tiles only go red when there is actually something to act on
	const danger = (count?: number) => (count ? 'text-danger' : undefined);

	const tiles = $derived<Tile[]>([
		{
			label: 'Grade',
			value: security.grade.letter,
			icon: ShieldCheck,
			hint: `Score ${security.grade.score}/100, weighted checks minus open alert penalties`,
			class: GRADE_COLOR[security.grade.letter]
		},
		{
			label: 'Checks passed',
			value: `${security.passed}/${security.applicable}`,
			icon: ListChecks,
			hint: 'Applicable checks currently passing'
		},
		{
			label: 'Open alerts',
			value: security.alerts?.total ?? '-',
			icon: Bug,
			hint: security.alerts
				? 'Open Dependabot vulnerability alerts'
				: 'Alerts not visible with this token'
		},
		{
			label: 'Critical',
			value: security.alerts?.counts.critical ?? '-',
			icon: ShieldAlert,
			hint: 'Open critical severity alerts',
			class: danger(security.alerts?.counts.critical)
		},
		{
			label: 'High',
			value: security.alerts?.counts.high ?? '-',
			icon: TriangleAlert,
			hint: 'Open high severity alerts',
			class: danger(security.alerts?.counts.high)
		},
		{
			label: 'Advisories',
			value: security.advisories.length,
			icon: Megaphone,
			hint: 'Security advisories published by the maintainers'
		}
	]);
</script>

<StatTileGrid {tiles} class="lg:grid-cols-6" />
