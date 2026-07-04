// GitHub reaction content names, with display glyph and label, in display order
export const REACTIONS: Record<string, { emoji: string; label: string }> = {
	'+1': { emoji: '👍', label: 'Thumbs up' },
	'-1': { emoji: '👎', label: 'Thumbs down' },
	laugh: { emoji: '😄', label: 'Laugh' },
	hooray: { emoji: '🎉', label: 'Hooray' },
	confused: { emoji: '😕', label: 'Confused' },
	heart: { emoji: '❤️', label: 'Heart' },
	rocket: { emoji: '🚀', label: 'Rocket' },
	eyes: { emoji: '👀', label: 'Eyes' }
};

// Canonical key list, shared by the feed normalisers and the UI
export const REACTION_KEYS = Object.keys(REACTIONS);
