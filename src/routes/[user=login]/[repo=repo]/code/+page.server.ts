import { getSupplyChain, isSupplyChainCached } from '$lib/server/github/supply-chain';
import { settle } from '$lib/server/load';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	const supplyChain = settle('supply-chain', getSupplyChain(params.user, params.repo));
	// Render inline when already cached, stream only the cold first fetch
	const ready = await isSupplyChainCached(params.user, params.repo);
	return { supplyChain: ready ? await supplyChain : supplyChain };
};
