import { invalidateAll } from '$app/navigation';
import { createLogger } from '$lib/utils/logger';

const log = createLogger('pending-retry');

// Widening gaps, then we stop rather than poll a fetch that is never going to land
const RETRY_DELAYS_MS = [4000, 8000, 15000, 30000, 60000];

let waiting = 0;
let step = 0;
let timer: ReturnType<typeof setTimeout> | undefined;

// Timer is held across the rerun, so panels remounting mid-cycle join it instead of resetting it
function schedule(): void {
	const delay = RETRY_DELAYS_MS[step];
	if (timer || delay === undefined) return;
	timer = setTimeout(() => {
		if (!waiting) {
			timer = undefined;
			return;
		}
		step += 1;
		invalidateAll()
			.catch((error) => log.warn('pending retry failed', error))
			.finally(() => {
				timer = undefined;
				schedule();
			});
	}, delay);
}

// Rerun the page load while any panel sits pending, an idle loop gets a fresh budget
export function joinPendingRetry(): () => void {
	if (!waiting && !timer) step = 0;
	waiting += 1;
	schedule();
	return () => void (waiting -= 1);
}
