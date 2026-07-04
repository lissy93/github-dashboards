import type { GradeLetter } from '$lib/types';

// Grade letters coloured by the same bands the score maps onto
export const GRADE_COLOR: Record<GradeLetter, string> = {
	A: 'text-success',
	B: 'text-success',
	C: 'text-warning',
	D: 'text-danger',
	F: 'text-danger'
};
