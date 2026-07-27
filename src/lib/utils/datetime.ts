// Calendar name constants, defined once. Weekday arrays are Monday-first
export const MONTHS_SHORT = [
	'Jan',
	'Feb',
	'Mar',
	'Apr',
	'May',
	'Jun',
	'Jul',
	'Aug',
	'Sep',
	'Oct',
	'Nov',
	'Dec'
];

export const DAYS_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// prettier-ignore
export const DAYS_FULL = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

// Shift a Sunday-first weekday index (JS getUTCDay) to our Monday-first arrays
export const toMondayFirst = (sundayFirst: number) => (sundayFirst + 6) % 7;

// First day (YYYY-MM-DD) of the Monday-first week containing a day or timestamp
export function weekStartOf(day: string): string {
	const ms = Date.parse(`${day.slice(0, 10)}T00:00:00Z`);
	const offset = toMondayFirst(new Date(ms).getUTCDay());
	return new Date(ms - offset * 86400000).toISOString().slice(0, 10);
}

// First day (YYYY-MM-DD) of the month containing a day or timestamp
export const monthStartOf = (day: string) => `${day.slice(0, 7)}-01`;

// First of the month after a given month-start date
function nextMonthStart(monthStart: string): string {
	let [year, month] = monthStart.slice(0, 7).split('-').map(Number);
	month += 1;
	if (month > 12) {
		month = 1;
		year += 1;
	}
	return `${year}-${String(month).padStart(2, '0')}-01`;
}

// Every month start from the first day's month through the last day's month, inclusive
export function monthStartsThrough(fromDay: string, toDay: string): string[] {
	const last = toDay.slice(0, 7);
	const months: string[] = [];
	let cursor = monthStartOf(fromDay);
	while (cursor.slice(0, 7) <= last) {
		months.push(cursor);
		cursor = nextMonthStart(cursor);
	}
	return months;
}

// Compact "MMM YY" label for a month-start date
export function monthLabel(monthStart: string): string {
	const [year, month] = monthStart.split('-');
	return `${MONTHS_SHORT[Number(month) - 1]} ${year.slice(2)}`;
}

// Linear value of a cumulative day-indexed series at a target day. Zero before the first
// day, held flat at the last value past the end
function interpolatedAt(days: string[], values: number[], targetDay: string): number {
	const target = Date.parse(targetDay);
	const first = Date.parse(days[0]);
	if (target <= first) return target < first ? 0 : values[0];
	if (target >= Date.parse(days[days.length - 1])) return values[values.length - 1];
	let index = 0;
	while (index + 1 < days.length && Date.parse(days[index + 1]) <= target) index += 1;
	const start = Date.parse(days[index]);
	const end = Date.parse(days[index + 1]);
	const frac = end === start ? 0 : (target - start) / (end - start);
	return values[index] + (values[index + 1] - values[index]) * frac;
}

// New value gained each month for a cumulative day series, as rounded deltas of the curve
// at month boundaries. before seeds the baseline so a trimmed curve counts only later gains
export function monthlyGains(
	days: string[],
	values: number[],
	monthStarts: string[],
	before = 0
): number[] {
	let running = Math.round(before);
	return monthStarts.map((month) => {
		const total = Math.round(interpolatedAt(days, values, nextMonthStart(month)));
		const gain = Math.max(0, total - running);
		running = total;
		return gain;
	});
}

// Middle value of a set, averaging the two middles for an even count
export function median(values: number[]): number | null {
	if (!values.length) return null;
	const sorted = [...values].sort((first, second) => first - second);
	const mid = Math.floor(sorted.length / 2);
	return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}
