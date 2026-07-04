import {
	outcomeBars,
	miniOutcomeBars,
	withinDays,
	type OutcomeChart,
	type OutcomeKind
} from '$lib/utils/outcomes';
import type { DeployRecord, RepoDeployments } from '$lib/types';

// Trailing windows for the deployment frequency chart, all-time spans the whole sample
export const DEPLOY_WINDOWS = [
	{ key: '30', label: 'Last 30 days', days: 30 },
	{ key: '90', label: 'Last 90 days', days: 90 },
	{ key: '365', label: 'Last year', days: 365 },
	{ key: 'all', label: 'All time', days: Infinity }
];

export type DeploymentView = { windowKey: string; environment: string };

export function defaultDeploymentView(): DeploymentView {
	return { windowKey: 'all', environment: '' };
}

// A deployment status state folded into the shared success / failure / other bands, used for
// the frequency chart and success rate. Active and success both count as a healthy deploy
export function deployBand(state: string | null): OutcomeKind {
	if (state === 'success' || state === 'active') return 'success';
	if (state === 'failure' || state === 'error') return 'failure';
	return 'other';
}

// Human label and colour token for a deployment status, matching the run status convention
export function deployState(state: string | null): {
	label: string;
	token: 'success' | 'danger' | 'warning' | 'muted';
} {
	switch (state) {
		case 'active':
			return { label: 'Active', token: 'success' };
		case 'success':
			return { label: 'Success', token: 'success' };
		case 'failure':
			return { label: 'Failed', token: 'danger' };
		case 'error':
			return { label: 'Error', token: 'danger' };
		case 'in_progress':
			return { label: 'In progress', token: 'warning' };
		case 'queued':
			return { label: 'Queued', token: 'warning' };
		case 'pending':
			return { label: 'Pending', token: 'warning' };
		case 'waiting':
			return { label: 'Waiting', token: 'warning' };
		case 'inactive':
			return { label: 'Inactive', token: 'muted' };
		default:
			return { label: 'No status', token: 'muted' };
	}
}

// Outcome bars over the chosen window, success and failure stacked per day or week
export function frequencyChart(deployments: RepoDeployments, windowKey: string): OutcomeChart {
	const days = DEPLOY_WINDOWS.find((window) => window.key === windowKey)?.days ?? Infinity;
	return outcomeBars(withinDays(deployments.frequency, days));
}

// All-time frequency rolled up into weeks or months for the compact overview panel, so bars
// stay wide and readable instead of a forest of thin daily slivers
export function deploymentMiniChart(deployments: RepoDeployments): OutcomeChart {
	return miniOutcomeBars(deployments.frequency);
}

// Recent deployments, optionally narrowed to one environment
export function filteredRecent(deployments: RepoDeployments, environment: string): DeployRecord[] {
	if (!environment) return deployments.recent;
	return deployments.recent.filter((record) => record.environment === environment);
}

// Environment choices for the table filter, busiest first to match the summary order
export function environmentOptions(
	deployments: RepoDeployments
): { value: string; label: string }[] {
	return deployments.environments
		.filter((env) => env.count > 0)
		.map((env) => ({ value: env.name, label: env.name }));
}
