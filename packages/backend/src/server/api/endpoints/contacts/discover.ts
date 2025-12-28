import define from '../../define.js';
import { ContactService } from '@/services/contact-service.js';
import { Users } from '@/models/index.js';

export const meta = {
	tags: ['contacts', 'users'],
	requireCredential: true,
	kind: 'read:contacts',
	
	description: 'Get contact matches (friends found from imported contacts)',
	
	res: {
		type: 'array',
		optional: false,
		nullable: false,
		items: {
			type: 'object',
			optional: false,
			nullable: false,
			ref: 'UserLite',
		},
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		limit: { 
			type: 'integer', 
			minimum: 1, 
			maximum: 100, 
			default: 20 
		},
		sinceId: { 
			type: 'string', 
			format: 'barkle:id' 
		},
		untilId: { 
			type: 'string', 
			format: 'barkle:id' 
		},
	},
	required: [],
} as const;

export default define(meta, paramDef, async (ps, user) => {
	const contactService = new ContactService();
	
	// Get contact matches for the user
	const matches = await contactService.getContactMatches(user.id);
	
	// Extract the matched users
	const matchedUsers = matches.map(match => match.user);
	
	// Apply pagination if requested
	let users = matchedUsers;
	if (ps.sinceId || ps.untilId) {
		// Simple pagination based on user IDs
		// In production, you might want more sophisticated pagination
		if (ps.sinceId) {
			const sinceIndex = users.findIndex(u => u.id === ps.sinceId);
			if (sinceIndex >= 0) {
				users = users.slice(sinceIndex + 1);
			}
		}
		if (ps.untilId) {
			const untilIndex = users.findIndex(u => u.id === ps.untilId);
			if (untilIndex >= 0) {
				users = users.slice(0, untilIndex);
			}
		}
	}
	
	// Apply limit
	users = users.slice(0, ps.limit);
	
	// Pack users for response
	return await Users.packMany(users, user, { detail: false });
});
