import { getSupplyChain } from '$lib/server/github/supply-chain';
import { inlineReady, settle } from '$lib/server/load';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, parent, isDataRequest }) => {
	// the layout 404s hidden repos, so gate on it before fanning out
	await parent();
	const supplyChain = settle('supply-chain', getSupplyChain(params.user, params.repo));
	return inlineReady({ supplyChain }, isDataRequest);
};
