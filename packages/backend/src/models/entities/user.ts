import { Entity, Column, Index, OneToOne, JoinColumn, PrimaryColumn } from 'typeorm';
import { id } from '../id.js';
import { DriveFile } from './drive-file.js';
import { SubscriptionStatus } from '../../types/subscription-status.enum.js';

@Entity()
@Index(['usernameLower', 'host'], { unique: true })
export class User {
	@PrimaryColumn(id())
	public id: string;

	@Index()
	@Column('timestamp with time zone', {
		comment: 'The created date of the User.',
	})
	public createdAt: Date;

	@Index()
	@Column('timestamp with time zone', {
		nullable: true,
		comment: 'The updated date of the User.',
	})
	public updatedAt: Date | null;

	@Column('timestamp with time zone', {
		nullable: true,
	})
	public lastFetchedAt: Date | null;

	@Index()
	@Column('timestamp with time zone', {
		nullable: true,
	})
	public lastActiveDate: Date | null;

	@Column('boolean', {
		default: false,
	})
	public hideOnlineStatus: boolean;

	@Column('varchar', {
		length: 128,
		comment: 'The username of the User.',
	})
	public username: string;

	@Index()
	@Column('varchar', {
		length: 128, select: false,
		comment: 'The username (lowercased) of the User.',
	})
	public usernameLower: string;

	@Column('varchar', {
		length: 128, nullable: true,
		comment: 'The name of the User.',
	})
	public name: string | null;

	@Column('integer', {
		default: 0,
		comment: 'The count of followers.',
	})
	public followersCount: number;

	@Column('integer', {
		default: 0,
		comment: 'The count of following.',
	})
	public followingCount: number;

	@Index()
	@Column('integer', {
		default: 0,
		comment: 'Number of times this user has been blocked by others.',
	})
	public blocksReceivedCount: number;

	@Index()
	@Column('integer', {
		default: 0,
		comment: 'Number of times this user has been muted by others.',
	})
	public mutesReceivedCount: number;

	@Index()
	@Column('double precision', {
		default: 0.5,
		nullable: true,
		comment: 'User reputation score (0-1 range) based on multiple factors.',
	})
	public reputationScore: number | null;

	@Column('varchar', {
		length: 512,
		nullable: true,
		comment: 'The URI of the new account of the User',
	})
	public movedToUri: string | null;

	@Column('simple-array', {
		nullable: true,
		comment: 'URIs the user is known as too',
	})
	public alsoKnownAs: string[] | null;

	@Column('integer', {
		default: 0,
		comment: 'The count of notes.',
	})
	public notesCount: number;

	@Column({
		...id(),
		nullable: true,
		comment: 'The ID of avatar DriveFile.',
	})
	public avatarId: DriveFile['id'] | null;

	@OneToOne(type => DriveFile, {
		onDelete: 'SET NULL',
	})
	@JoinColumn()
	public avatar: DriveFile | null;

	@Column({
		...id(),
		nullable: true,
		comment: 'The ID of banner DriveFile.',
	})
	public bannerId: DriveFile['id'] | null;

	@OneToOne(type => DriveFile, {
		onDelete: 'SET NULL',
	})
	@JoinColumn()
	public banner: DriveFile | null;

	@Index()
	@Column('varchar', {
		length: 128, array: true, default: '{}',
	})
	public tags: string[];

	@Column('boolean', {
		default: false,
		comment: 'Whether the User is suspended.',
	})
	public isSuspended: boolean;

	@Column('boolean', {
		default: false,
		comment: 'Whether the User is silenced.',
	})
	public isSilenced: boolean;

	@Column('boolean', {
		default: false,
		comment: 'Whether the User is locked.',
	})
	public isLocked: boolean;

	@Column('boolean', {
		default: false,
		comment: 'Whether the User is a bot.',
	})
	public isBot: boolean;

	@Column('boolean', {
		default: false,
		comment: 'Whether the User is a Verified.',
	})
	public isVerified: boolean;

	@Column('boolean', {
		default: false,
		comment: 'Whether the User is a Avunite staff member.',
	})
	public isStaff: boolean;

	@Column('boolean', {
		default: false,
		comment: 'Whether the User is a Avunite staff member.',
	})
	public isTranslator: boolean;

	@Column('boolean', {
		default: false,
		comment: 'Whether the User is a Avunite staff member.',
	})
	public hasAlgoBeta: boolean;

	@Column('boolean', {
		default: false,
		comment: 'Whether the User is an OG.',
	})
	public isOG: boolean;

	@Column('boolean', {
		default: false,
		comment: 'Whether the User is plus.',
	})
	public isPlus: boolean;

	@Column('boolean', {
		default: false,
		comment: 'Whether the User is mini plus.',
	})
	public isMPlus: boolean;

	@Column('boolean', {
		default: false,
		comment: 'Whether the User is mini plus.',
	})
	public isLive: boolean;

	@Column('boolean', {
		default: false,
		comment: 'Whether the User is a cat.',
	})
	public isCat: boolean;

	@Column('boolean', {
		default: false,
		comment: 'Whether the User is the admin.',
	})
	public isAdmin: boolean;

	@Column('boolean', {
		default: false,
		comment: 'Whether the User is a moderator.',
	})
	public isModerator: boolean;

	@Index()
	@Column('boolean', {
		default: true,
		comment: 'Whether the User is explorable.',
	})
	public isExplorable: boolean;

	// アカウントが削除されたかどうかのフラグだが、完全に削除される際は物理削除なので実質削除されるまでの「削除が進行しているかどうか」のフラグ
	@Column('boolean', {
		default: false,
		comment: 'Whether the User is deleted.',
	})
	public isDeleted: boolean;

	@Column('varchar', {
		length: 128, array: true, default: '{}',
	})
	public emojis: string[];

	@Column('varchar', {
		length: 128, array: true, default: '{}',
	})
	public stripe_user: string[];

	@Index()
	@Column('varchar', {
		length: 128, nullable: true,
		comment: 'The host of the User. It will be null if the origin of the user is local.',
	})
	public host: string | null;

	@Column('varchar', {
		length: 512, nullable: true,
		comment: 'The inbox URL of the User. It will be null if the origin of the user is local.',
	})
	public inbox: string | null;

	@Column('varchar', {
		length: 512, nullable: true,
		comment: 'The sharedInbox URL of the User. It will be null if the origin of the user is local.',
	})
	public sharedInbox: string | null;

	@Column('varchar', {
		length: 512, nullable: true,
		comment: 'The featured URL of the User. It will be null if the origin of the user is local.',
	})
	public featured: string | null;

	@Index()
	@Column('varchar', {
		length: 512, nullable: true,
		comment: 'The URI of the User. It will be null if the origin of the user is local.',
	})
	public uri: string | null;

	@Index()
	@Column('varchar', {
		length: 512, nullable: true,
		comment: 'The URI of the User. It will be null if the origin of the user is local.',
	})
	public liveUrl: string | null;

	@Column('varchar', {
		length: 512, nullable: true,
		comment: 'The URI of the user Follower Collection. It will be null if the origin of the user is local.',
	})
	public followersUri: string | null;

	@Column('boolean', {
		default: false,
		comment: 'Whether to show users replying to other users in the timeline.',
	})
	public showTimelineReplies: boolean;

	@Index({ unique: true })
	@Column('char', {
		length: 16, nullable: true, unique: true,
		comment: 'The native access token of the User. It will be null if the origin of the user is local.',
	})
	public token: string | null;

	@Column('integer', {
		nullable: true,
		comment: 'Overrides user drive capacity limit',
	})
	public driveCapacityOverrideMb: number | null;

	@Column('jsonb', {
		default: [],
		nullable: true,
	})
	public avatarDecorations: {
		id: string;
		angle?: number;
		flipH?: boolean;
		offsetX?: number;
		offsetY?: number;
	}[];

	@Column('timestamp with time zone', {
		nullable: true,
		comment: 'The date when the user subscription ends.',
	})
	public subscriptionEndDate: Date | null;

	@Column('varchar', {
		nullable: true,
		comment: 'The ID of the paused subscription when a gift is active.',
	})
	public pausedSubscriptionId: string | null;

	@Column('varchar', {
		length: 10,
		nullable: true,
		comment: 'The plan type of a stored gift credit.',
	})
	public giftCreditPlan: 'plus' | 'mplus' | null;

	@Column('timestamp with time zone', {
		nullable: true,
		comment: 'The end date of a stored gift credit.',
	})
	public giftCreditEndDate: Date | null;

	@Column('varchar', {
		length: 10,
		nullable: true,
		comment: 'The previous subscription plan to revert to after a gift ends.',
	})
	public previousSubscriptionPlan: 'plus' | 'mplus' | null;

	@Column('enum', {
		enum: SubscriptionStatus,
		default: SubscriptionStatus.FREE,
		comment: 'The current subscription status of the user.',
	})
	public subscriptionStatus: SubscriptionStatus;

	@Column('integer', {
		default: 0,
		comment: 'Number of Barkle+ credits available.',
	})
	public barklePlusCredits: number;

	@Column('integer', {
		default: 0,
		comment: 'Number of Mini+ credits available.',
	})
	public miniPlusCredits: number;

	@Column('timestamp with time zone', {
		nullable: true,
		comment: 'Expiration date for Barkle+ credits.',
	})
	public barklePlusCreditsExpiry: Date | null;

	@Column('timestamp with time zone', {
		nullable: true,
		comment: 'Expiration date for Mini+ credits.',
	})
	public miniPlusCreditsExpiry: Date | null;

	@Column('enum', {
		enum: ['stripe', 'revenuecat', 'credit'],
		nullable: true,
		comment: 'The platform through which the user subscribed (for preventing cross-platform management).',
	})
	public subscriptionPlatform: 'stripe' | 'revenuecat' | 'credit' | null;

	@Column('varchar', {
		length: 512,
		nullable: true,
		comment: 'RevenueCat App User ID for mobile subscription tracking.',
	})
	public revenueCatUserId: string | null;

	constructor(data: Partial<User>) {
		if (data == null) return;

		for (const [k, v] of Object.entries(data)) {
			(this as any)[k] = v;
		}
	}
}

export interface ILocalUser extends User {
	host: null;
}

export interface IRemoteUser extends User {
	host: string;
}

export type CacheableLocalUser = ILocalUser;

export type CacheableRemoteUser = IRemoteUser;

export type CacheableUser = CacheableLocalUser | CacheableRemoteUser;
