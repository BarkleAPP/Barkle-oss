import { Not } from 'typeorm';
import { ContactImport } from '../entities/contact-import.js';
import { db } from '@/db/postgre.js';
import { genId } from '@/misc/gen-id.js';

export const ContactImportRepository = db.getRepository(ContactImport).extend({
	async findByUserId(userId: string): Promise<ContactImport[]> {
		try {
			return await this.find({
				where: { userId },
				relations: ['matchedUser'],
				order: { createdAt: 'DESC' },
			});
		} catch (error) {
			console.error('[ContactImport] Error in findByUserId:', error);
			return [];
		}
	},

	async findMatchedByUserId(userId: string): Promise<ContactImport[]> {
		try {
			return await this.find({
				where: {
					userId,
					isMatched: true,
					matchedUserId: Not(null) as any,
				},
				relations: ['matchedUser'],
				order: { createdAt: 'DESC' },
			});
		} catch (error) {
			console.error('[ContactImport] Error in findMatchedByUserId:', error);
			// Return empty array instead of throwing to prevent cascade failures
			return [];
		}
	},

	async findByHashedContact(hashedContact: string): Promise<ContactImport[]> {
		try {
			return await this.find({
				where: { hashedContact },
				relations: ['user'],
			});
		} catch (error) {
			console.error('[ContactImport] Error in findByHashedContact:', error);
			return [];
		}
	},

	async createContact(
		userId: string,
		hashedContact: string,
		contactName?: string,
		source?: string,
	): Promise<ContactImport | null> {
		// Check if this contact already exists for this user
		const existing = await this.findOne({
			where: {
				userId,
				hashedContact,
			},
		});

		if (existing) {
			return existing;
		}

		const contact = this.create({
			id: genId(),
			userId,
			hashedContact,
			contactName: contactName || null,
			source: source || 'import',
			isMatched: false,
			matchedUserId: null,
		});

		return await this.save(contact);
	},

	async matchContact(
		contactImportId: string,
		matchedUserId: string,
	): Promise<void> {
		await this.update(contactImportId, {
			isMatched: true,
			matchedUserId,
		});
	},

	async getContactMatchCount(userId: string): Promise<number> {
		return this.count({
			where: {
				userId,
				isMatched: true,
			},
		});
	},

	async findByIdWithRelations(id: string): Promise<ContactImport | null> {
		return this.findOne({
			where: { id },
			relations: ['user', 'matchedUser'],
		});
	},
});
