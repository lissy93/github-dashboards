import type { Component } from 'svelte';
import {
	GitPullRequest,
	GitMerge,
	CircleDot,
	MessageSquare,
	FileCheck,
	Tag,
	GitCommit,
	Star,
	GitFork,
	GitBranch,
	Trash2,
	BookOpen,
	Globe,
	UserPlus,
	MessagesSquare,
	Heart
} from '@lucide/svelte';
import { plural } from '$lib/utils/format';
import type { ActivityEvent, ActivityType } from '$lib/types';

type IconComponent = Component<{ size?: number | string; class?: string }>;
type Meta = { icon: IconComponent; color: string; label: string };

// Define icon, colour and tag for every activity type once, reused on each row
const META: Record<ActivityType, Meta> = {
	pr: { icon: GitPullRequest, color: 'text-open', label: 'PR' },
	issue: { icon: CircleDot, color: 'text-open', label: 'Issue' },
	comment: { icon: MessageSquare, color: 'text-info', label: 'Comment' },
	review: { icon: FileCheck, color: 'text-info', label: 'Review' },
	release: { icon: Tag, color: 'text-primary', label: 'Release' },
	push: { icon: GitCommit, color: 'text-muted-foreground', label: 'Push' },
	star: { icon: Star, color: 'text-warning', label: 'Star' },
	fork: { icon: GitFork, color: 'text-muted-foreground', label: 'Fork' },
	create: { icon: GitBranch, color: 'text-success', label: 'Create' },
	delete: { icon: Trash2, color: 'text-muted-foreground', label: 'Delete' },
	wiki: { icon: BookOpen, color: 'text-info', label: 'Wiki' },
	public: { icon: Globe, color: 'text-success', label: 'Public' },
	member: { icon: UserPlus, color: 'text-info', label: 'Member' },
	discussion: { icon: MessagesSquare, color: 'text-info', label: 'Discussion' },
	sponsor: { icon: Heart, color: 'text-primary', label: 'Sponsor' }
};

export const activityLabel = (type: ActivityType): string => META[type]?.label ?? type;

// Merged PRs get their own glyph, everything else uses its type icon
export function activityIcon(event: ActivityEvent): IconComponent {
	if (event.type === 'pr' && event.action === 'merged') return GitMerge;
	return META[event.type]?.icon ?? GitCommit;
}

// State colour for PRs and issues, otherwise the type's base colour
export function activityColor(event: ActivityEvent): string {
	if (event.type === 'pr') {
		if (event.action === 'merged') return 'text-merged';
		if (event.action === 'closed') return 'text-closed';
		return 'text-open';
	}
	if (event.type === 'issue') return event.action === 'closed' ? 'text-closed' : 'text-open';
	return META[event.type]?.color ?? 'text-muted-foreground';
}

type Payload = { number?: number; count?: number; branch?: string; on?: string; refType?: string };

const REVIEW_PHRASE: Record<string, string> = {
	approved: 'approved',
	changes_requested: 'requested changes on',
	commented: 'reviewed',
	dismissed: 'dismissed a review on',
	resolved: 'resolved a thread on',
	unresolved: 'reopened a thread on'
};

const SPONSOR_PHRASE: Record<string, string> = {
	created: 'started sponsoring',
	cancelled: 'cancelled sponsorship of',
	tier_changed: 'changed sponsorship tier for',
	pending_cancellation: 'is ending sponsorship of'
};

// Comment targets keyed by the payload "on" field, defaulting to issue
const COMMENT_ON: Record<string, string> = { pr: 'PR', discussion: 'discussion' };

// A short human phrase for the action, e.g. "merged PR #7" or "pushed 3 commits"
export function activitySummary(event: ActivityEvent): string {
	const p = (event.payload ?? {}) as Payload;
	switch (event.type) {
		case 'pr':
			return `${event.action} PR #${p.number}`;
		case 'issue':
			return `${event.action} issue #${p.number}`;
		case 'comment':
			return p.number
				? `commented on ${COMMENT_ON[p.on ?? ''] ?? 'issue'} #${p.number}`
				: 'commented';
		case 'review':
			return `${REVIEW_PHRASE[event.action ?? ''] ?? 'reviewed'} PR #${p.number}`;
		case 'discussion':
			return `started discussion #${p.number}`;
		case 'sponsor':
			return SPONSOR_PHRASE[event.action ?? ''] ?? 'sponsored';
		case 'release':
			return 'published a release';
		case 'push': {
			const count = p.count ?? 0;
			const target = p.branch ? ` to ${p.branch}` : '';
			// A 0-commit push is a force-push or no-op ref update, so skip the misleading count
			if (count === 0) return `pushed${target}`;
			return `pushed ${count} ${plural(count, 'commit')}${target}`;
		}
		case 'star':
			return 'starred';
		case 'fork':
			return 'forked';
		case 'create':
			return `created ${p.refType ?? 'repository'}`;
		case 'delete':
			return `deleted ${p.refType ?? 'ref'}`;
		case 'wiki':
			return 'edited the wiki';
		case 'public':
			return 'made public';
		case 'member':
			return 'added a collaborator';
		default:
			return event.action ?? '';
	}
}

// Type options for the feed filter, derived from the icon/label map
export const ACTIVITY_TYPE_OPTIONS = (Object.keys(META) as ActivityType[]).map((type) => ({
	value: type,
	label: META[type].label
}));
