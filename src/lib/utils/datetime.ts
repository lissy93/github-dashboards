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

// Middle value of a set, averaging the two middles for an even count
export function median(values: number[]): number | null {
	if (!values.length) return null;
	const sorted = [...values].sort((first, second) => first - second);
	const mid = Math.floor(sorted.length / 2);
	return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}
