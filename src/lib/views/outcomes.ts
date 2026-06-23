import { MONTHS_SHORT } from '$lib/datetime';
import type { StackBar, StackSeries } from '$lib/views/stats';

const DAY_MS = 86400000;
// Past this many days a daily axis gets too dense, so bars roll up into weeks
const WEEKLY_SPAN_DAYS = 84;

// One day of run or deployment outcomes
export type OutcomeBucket = { date: string; success: number; failure: number; other: number };
export type OutcomeKind = 'success' | 'failure' | 'other';

// Shared outcome series for the run and deployment timelines, from the action tokens
export const OUTCOME_SERIES: StackSeries[] = [
	{ key: 'success', label: 'Success', color: 'var(--success)', hint: 'Completed successfully' },
	{
		key: 'failure',
		label: 'Failure',
		color: 'var(--danger)',
		hint: 'Failed, errored or timed out'
	},
	{
		key: 'other',
		label: 'Other',
		color: 'var(--muted-foreground)',
		hint: 'Cancelled, skipped or still in progress'
	}
];

// Roll timestamped outcomes into ascending per-day buckets, dropping empty days so the
// cached payload stays compact. Gap filling and granularity are left to the chart builder
export function bucketOutcomes(entries: { at: string; outcome: OutcomeKind }[]): OutcomeBucket[] {
	const byDay = new Map<string, OutcomeBucket>();
	for (const { at, outcome } of entries) {
		const date = at.slice(0, 10);
		const bucket = byDay.get(date) ?? { date, success: 0, failure: 0, other: 0 };
		bucket[outcome] += 1;
		byDay.set(date, bucket);
	}
	return [...byDay.values()].sort((a, b) => a.date.localeCompare(b.date));
}

// Keep only buckets within the trailing window, all-time when sinceDays is not finite
export function withinDays(buckets: OutcomeBucket[], sinceDays: number): OutcomeBucket[] {
	if (!Number.isFinite(sinceDays)) return buckets;
	const cutoff = new Date(Date.now() - sinceDays * DAY_MS).toISOString().slice(0, 10);
	return buckets.filter((bucket) => bucket.date >= cutoff);
}

// Full human date, used as each bar's unique key and tooltip title
function barLabel(date: string): string {
	const [year, month, day] = date.split('-').map(Number);
	return `${day} ${MONTHS_SHORT[month - 1]} ${year}`;
}

// Sparse axis labels parallel to the bars: the year at each year change over a multi-year
// span, otherwise the month at each month change, blank elsewhere so the axis stays legible
function axisTicks(dates: string[], multiYear: boolean): string[] {
	let prevYear = '';
	let prevMonth = '';
	return dates.map((date) => {
		const [year, month] = date.split('-');
		if (multiYear) {
			if (year === prevYear) return '';
			prevYear = year;
			return year;
		}
		if (month === prevMonth && year === prevYear) return '';
		prevYear = year;
		prevMonth = month;
		return MONTHS_SHORT[Number(month) - 1];
	});
}

export type OutcomeChart = { bars: StackBar[]; series: StackSeries[]; ticks: string[] };

// Gap-filled outcome bars over the bucket span, daily for short ranges and weekly for long
// ones so a sparse or busy history both read as an even timeline
export function outcomeBars(buckets: OutcomeBucket[]): OutcomeChart {
	if (!buckets.length) return { bars: [], series: OUTCOME_SERIES, ticks: [] };

	const start = Date.parse(buckets[0].date);
	const end = Date.parse(buckets[buckets.length - 1].date);
	const weekly = (end - start) / DAY_MS > WEEKLY_SPAN_DAYS;
	const step = weekly ? 7 * DAY_MS : DAY_MS;

	// Fold each day into its slot, slots aligned to the first sampled day
	const slots = new Map<string, OutcomeBucket>();
	for (const bucket of buckets) {
		const offset = Math.floor((Date.parse(bucket.date) - start) / step);
		const date = new Date(start + offset * step).toISOString().slice(0, 10);
		const slot = slots.get(date) ?? { date, success: 0, failure: 0, other: 0 };
		slot.success += bucket.success;
		slot.failure += bucket.failure;
		slot.other += bucket.other;
		slots.set(date, slot);
	}

	const dates: string[] = [];
	const bars: StackBar[] = [];
	for (let time = start; time <= end; time += step) {
		const date = new Date(time).toISOString().slice(0, 10);
		const slot = slots.get(date) ?? { date, success: 0, failure: 0, other: 0 };
		dates.push(date);
		bars.push({
			label: barLabel(date),
			values: { success: slot.success, failure: slot.failure, other: slot.other },
			total: slot.success + slot.failure + slot.other
		});
	}
	// Year labels suit a long multi-year weekly span, month labels suit shorter ranges
	const multiYear = weekly && dates[0].slice(0, 4) !== dates[dates.length - 1].slice(0, 4);
	return { bars, series: OUTCOME_SERIES, ticks: axisTicks(dates, multiYear) };
}
