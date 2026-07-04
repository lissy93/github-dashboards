import { toMondayFirst } from '$lib/utils/datetime';
import type { ActivityRhythm } from '$lib/types';

// Weekday-by-hour punch card from Sunday-first (dow, hour, count) samples
export function buildPunchCard(samples: Iterable<[number, number, number]>): ActivityRhythm {
	const punch = Array.from({ length: 7 }, () => new Array<number>(24).fill(0));
	let total = 0;
	for (const [dow, hour, count] of samples) {
		punch[toMondayFirst(dow)][hour] += count;
		total += count;
	}
	let peak: ActivityRhythm['peak'] = null;
	punch.forEach((row, weekday) =>
		row.forEach((count, hour) => {
			if (count > 0 && (!peak || count > peak.count)) peak = { weekday, hour, count };
		})
	);
	return { total, punch, peak };
}
