import { json } from '@sveltejs/kit';
import { purgeExpiredNow } from '$lib/server/cache';
import { pruneSnapshots } from '$lib/server/retention';
import { snapshotTrackedTraffic } from '$lib/server/github/traffic';
import { config } from '$lib/server/env';
import { apiError } from '$lib/server/response';
import type { RequestHandler } from './$types';

// Daily cron sweep, serverless freezes before the in-request purge reliably lands
export const GET: RequestHandler = async ({ request }) => {
	if (config.CRON_SECRET && request.headers.get('authorization') !== `Bearer ${config.CRON_SECRET}`)
		return json({ error: 'unauthorized' }, { status: 401 });
	try {
		// Traffic waits on GitHub and the sweep on the DB, so run them side by side
		await Promise.all([snapshotTrackedTraffic(), purgeExpiredNow().then(() => pruneSnapshots())]);
		return json({ ok: true });
	} catch (caught) {
		return apiError('maintenance', caught);
	}
};
