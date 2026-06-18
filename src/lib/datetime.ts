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
