import define from '../../define.js';
import { ContactService } from '@/services/contact-service.js';

export const meta = {
	tags: ['contacts'],
	requireCredential: true,
	kind: 'read:contacts',
	
	description: 'Get contact import statistics for the current user',
	
	res: {
		type: 'object',
		optional: false,
		nullable: false,
		properties: {
			totalMatches: {
				type: 'integer',
				optional: false,
				nullable: false,
				description: 'Total number of contact matches found',
			},
		},
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {},
	required: [],
} as const;

export default define(meta, paramDef, async (ps, user) => {
	const contactService = new ContactService();
	
	const totalMatches = await contactService.getContactMatchCount(user.id);
	
	return {
		totalMatches,
	};
});
