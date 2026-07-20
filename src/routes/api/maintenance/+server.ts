import { json } from '@sveltejs/kit';
import { sql } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { purgeExpiredNow } from '$lib/server/cache';
import { CONTRIBUTORS_KEY_PREFIX } from '$lib/server/github/contributors';
import { config } from '$lib/server/env';
import { apiError } from '$lib/server/response';
import type { RequestHandler } from './$types';

// Daily cron sweep, serverless freezes before the in-request purge reliably lands
export const GET: RequestHandler = async ({ request }) => {
	if (config.CRON_SECRET && request.headers.get('authorization') !== `Bearer ${config.CRON_SECRET}`)
		return json({ error: 'unauthorized' }, { status: 401 });
	try {
		await purgeExpiredNow();
		// Churn history is fully rebuildable from GitHub, drop rows for repos we no longer cache
		await db.execute(sql`
			delete from repo_churn_weekly w
			where not exists (
				select 1 from cache_entry c where c.key = ${CONTRIBUTORS_KEY_PREFIX} || w.repo
			)`);
		return json({ ok: true });
	} catch (caught) {
		return apiError('maintenance', caught);
	}
};
