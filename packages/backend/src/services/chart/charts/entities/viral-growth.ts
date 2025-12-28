import Chart from '../../core.js';

export const name = 'viral-growth';

export const schema = {
	// Following metrics
	'follows.total': { range: 'small' },
	'follows.fromInvitation': { range: 'small' },
	'follows.organic': { range: 'small' },

	// Invitation metrics
	'invitations.sent': { range: 'small' },
	'invitations.accepted': { range: 'small' },
	'invitations.newUserSignups': { range: 'small' },

	// Viral coefficient metrics
	'viralCoefficient.completedLoops': { range: 'small' },
	'viralCoefficient.newUsersFromInvitations': { range: 'small' },
	'viralCoefficient.chainReactions': { range: 'small' },

	// Viral moments
	'viralMoments.total': { range: 'small' },
	'viralMoments.rapid_growth': { range: 'small' },
	'viralMoments.network_effect': { range: 'small' },
	'viralMoments.milestone_reached': { range: 'small' },
	'viralMoments.viral_content': { range: 'small' },

	// High amplification events
	'highAmplification.total': { range: 'small' },
	'highAmplification.rapid_growth': { range: 'small' },
	'highAmplification.network_effect': { range: 'small' },
	'highAmplification.milestone_reached': { range: 'small' },

	// Network expansion
	'networkExpansion.total': { range: 'small' },
	'networkExpansion.suggestions': { range: 'small' },

	// Recommendation boosts
	'recommendationBoosts.total': { range: 'small' },

	// Growth momentum metrics
	'momentum.highScoreUsers': { range: 'small' },
	'momentum.averageScore': { range: 'small' },

	// Content amplification metrics
	'contentAmplification.total': { range: 'small' },
	'contentAmplification.low': { range: 'small' },
	'contentAmplification.medium': { range: 'small' },
	'contentAmplification.high': { range: 'small' },
	'contentAmplification.viral': { range: 'small' },
	'contentAmplification.engagementScore': { range: 'small' },

	// Viral amplification
	'viralAmplification.total': { range: 'small' },
	'viralAmplification.contentBoosts': { range: 'small' },

	// Creator boosts
	'creatorBoosts.total': { range: 'small' },
	'creatorBoosts.duration': { range: 'small' },

	// Milestone recognition
	'milestoneRecognition.total': { range: 'small' },
	'milestoneRecognition.user_milestone': { range: 'small' },
	'milestoneRecognition.content_milestone': { range: 'small' },
	'milestoneRecognition.network_milestone': { range: 'small' },
	'milestoneRecognition.bronze': { range: 'small' },
	'milestoneRecognition.silver': { range: 'small' },
	'milestoneRecognition.gold': { range: 'small' },
	'milestoneRecognition.platinum': { range: 'small' },
} as const;

export const entity = Chart.schemaToEntity(name, schema);