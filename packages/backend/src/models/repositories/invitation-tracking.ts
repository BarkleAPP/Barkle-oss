import { Not, IsNull } from 'typeorm';
import { InvitationTracking } from '../entities/invitation-tracking.js';
import { db } from '@/db/postgre.js';
import { genId } from '@/misc/gen-id.js';

export const InvitationTrackingRepository = db.getRepository(InvitationTracking).extend({
	async findByInviterId(inviterId: string): Promise<InvitationTracking[]> {
		return this.find({
			where: { inviterId },
			relations: ['acceptedUser'],
			order: { createdAt: 'DESC' },
		});
	},

	async findByInviteCode(inviteCode: string): Promise<InvitationTracking | null> {
		return this.findOne({
			where: { inviteCode },
			relations: ['inviter', 'acceptedUser'],
		});
	},

	async findAcceptedByInviterId(inviterId: string): Promise<InvitationTracking[]> {
		return this.find({
			where: { 
				inviterId,
				isAccepted: true,
				acceptedUserId: Not(IsNull()),
			},
			relations: ['acceptedUser'],
			order: { acceptedAt: 'DESC' },
		});
	},

	async findPendingByInviterId(inviterId: string): Promise<InvitationTracking[]> {
		return this.find({
			where: { 
				inviterId,
				isAccepted: false,
			},
			order: { createdAt: 'DESC' },
		});
	},

	async createInvitation(data: {
		inviterId: string;
		inviteCode: string;
		method: 'sms' | 'email' | 'social' | 'link';
		recipientIdentifier?: string;
		recipientName?: string;
		expiresAt?: Date;
		metadata?: Record<string, any>;
	}): Promise<InvitationTracking> {
		const invitation = this.create({
			id: genId(),
			inviterId: data.inviterId,
			inviteCode: data.inviteCode,
			method: data.method,
			recipientIdentifier: data.recipientIdentifier || null,
			recipientName: data.recipientName || null,
			expiresAt: data.expiresAt || null,
			metadata: data.metadata || {},
			isAccepted: false,
			acceptedUserId: null,
			acceptedAt: null,
		});

		return await this.save(invitation);
	},

	async acceptInvitation(
		inviteCode: string,
		acceptedUserId: string,
	): Promise<InvitationTracking | null> {
		const invitation = await this.findOne({
			where: { inviteCode },
		});

		if (!invitation || invitation.isAccepted) {
			return null;
		}

		// Check if invitation is expired
		if (invitation.expiresAt && invitation.expiresAt < new Date()) {
			return null;
		}

		invitation.isAccepted = true;
		invitation.acceptedUserId = acceptedUserId;
		invitation.acceptedAt = new Date();

		return await this.save(invitation);
	},

	async getInvitationStats(inviterId: string): Promise<{
		totalSent: number;
		accepted: number;
		pending: number;
		acceptanceRate: number;
	}> {
		const totalSent = await this.count({
			where: { inviterId },
		});

		const accepted = await this.count({
			where: { 
				inviterId,
				isAccepted: true,
			},
		});

		const pending = totalSent - accepted;
		const acceptanceRate = totalSent > 0 ? (accepted / totalSent) * 100 : 0;

		return {
			totalSent,
			accepted,
			pending,
			acceptanceRate: Math.round(acceptanceRate * 100) / 100,
		};
	},

	async findByIdWithRelations(id: string): Promise<InvitationTracking | null> {
		return this.findOne({
			where: { id },
			relations: ['inviter', 'acceptedUser'],
		});
	},

	async isInviteCodeValid(inviteCode: string): Promise<boolean> {
		const invitation = await this.findOne({
			where: { inviteCode },
		});

		if (!invitation || invitation.isAccepted) {
			return false;
		}

		// Check if invitation is expired
		if (invitation.expiresAt && invitation.expiresAt < new Date()) {
			return false;
		}

		return true;
	},

	async getRecentInvitations(inviterId: string, limit: number = 10): Promise<InvitationTracking[]> {
		return this.find({
			where: { inviterId },
			relations: ['acceptedUser'],
			order: { createdAt: 'DESC' },
			take: limit,
		});
	},
});