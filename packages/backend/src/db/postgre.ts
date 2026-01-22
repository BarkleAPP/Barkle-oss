// https://github.com/typeorm/typeorm/issues/2400
import pg from 'pg';
pg.types.setTypeParser(20, Number);

import { Logger, DataSource } from 'typeorm';
import * as highlight from 'cli-highlight';
import config from '@/config/index.js';

import { User } from '@/models/entities/user.js';
import { DriveFile } from '@/models/entities/drive-file.js';
import { DriveFolder } from '@/models/entities/drive-folder.js';
import { AccessToken } from '@/models/entities/access-token.js';
import { App } from '@/models/entities/app.js';
import { PollVote } from '@/models/entities/poll-vote.js';
import { Note } from '@/models/entities/note.js';
import { NoteReaction } from '@/models/entities/note-reaction.js';
import { NoteWatching } from '@/models/entities/note-watching.js';
import { NoteThreadMuting } from '@/models/entities/note-thread-muting.js';
import { NoteUnread } from '@/models/entities/note-unread.js';
import { Notification } from '@/models/entities/notification.js';
import { Meta } from '@/models/entities/meta.js';
import { Following } from '@/models/entities/following.js';
import { Instance } from '@/models/entities/instance.js';
import { Muting } from '@/models/entities/muting.js';
import { SwSubscription } from '@/models/entities/sw-subscription.js';
import { Blocking } from '@/models/entities/blocking.js';
import { UserList } from '@/models/entities/user-list.js';
import { UserListJoining } from '@/models/entities/user-list-joining.js';
import { UserGroup } from '@/models/entities/user-group.js';
import { UserGroupJoining } from '@/models/entities/user-group-joining.js';
import { UserGroupInvitation } from '@/models/entities/user-group-invitation.js';
import { Hashtag } from '@/models/entities/hashtag.js';
import { NoteFavorite } from '@/models/entities/note-favorite.js';
import { AbuseUserReport } from '@/models/entities/abuse-user-report.js';
import { RegistrationTicket } from '@/models/entities/registration-tickets.js';
import { MessagingMessage } from '@/models/entities/messaging-message.js';
import { MessagingMessageReaction } from '@/models/entities/messaging-message-reaction.js';
import { Signin } from '@/models/entities/signin.js';
import { AuthSession } from '@/models/entities/auth-session.js';
import { FollowRequest } from '@/models/entities/follow-request.js';
import { Emoji } from '@/models/entities/emoji.js';
import { Decoration } from '@/models/entities/decoration.js';
import { Streams } from '@/models/entities/streams.js';
import { UserNotePining } from '@/models/entities/user-note-pining.js';
import { Poll } from '@/models/entities/poll.js';
import { UserKeypair } from '@/models/entities/user-keypair.js';
import { UserPublickey } from '@/models/entities/user-publickey.js';
import { UserProfile } from '@/models/entities/user-profile.js';
import { UserSecurityKey } from '@/models/entities/user-security-key.js';
import { AttestationChallenge } from '@/models/entities/attestation-challenge.js';
import { Page } from '@/models/entities/page.js';
import { PageLike } from '@/models/entities/page-like.js';
import { GalleryPost } from '@/models/entities/gallery-post.js';
import { GalleryLike } from '@/models/entities/gallery-like.js';
import { ModerationLog } from '@/models/entities/moderation-log.js';
import { UsedUsername } from '@/models/entities/used-username.js';
import { Announcement } from '@/models/entities/announcement.js';
import { AnnouncementRead } from '@/models/entities/announcement-read.js';
import { Clip } from '@/models/entities/clip.js';
import { ClipNote } from '@/models/entities/clip-note.js';
import { Antenna } from '@/models/entities/antenna.js';
import { AntennaNote } from '@/models/entities/antenna-note.js';
import { PromoNote } from '@/models/entities/promo-note.js';
import { PromoRead } from '@/models/entities/promo-read.js';
import { Relay } from '@/models/entities/relay.js';
import { MutedNote } from '@/models/entities/muted-note.js';
import { Channel } from '@/models/entities/channel.js';
import { ChannelFollowing } from '@/models/entities/channel-following.js';
import { ChannelNotePining } from '@/models/entities/channel-note-pining.js';
import { RegistryItem } from '@/models/entities/registry-item.js';
import { Ad } from '@/models/entities/ad.js';
import { PasswordResetRequest } from '@/models/entities/password-reset-request.js';
import { UserPending } from '@/models/entities/user-pending.js';
import { Webhook } from '@/models/entities/webhook.js';
import { UserIp } from '@/models/entities/user-ip.js';
import { GiftedSubscription } from '@/models/entities/gifted-subscription.js'; // Import GiftedSubscription
import { LiveChatMessage } from '@/models/entities/live-chat-message.js';
import { StreamModerators } from '@/models/entities/stream-moderators.js';
import { UserEncryptionKey } from '@/models/entities/user-encryption-key.js';
import { MessageEncryptionKey } from '@/models/entities/message-encryption-key.js';
import { UserEncryptionPreference } from '@/models/entities/user-encryption-preference.js';
import { UserMusicIntegration } from '@/models/entities/user-music-integration.js';
import { ContactImport } from '@/models/entities/contact-import.js';
import { FirebaseToken } from '@/models/entities/firebase-token.js';
import { NotificationSchedule } from '@/models/entities/notification-schedule.js';
import { InvitationTracking } from '@/models/entities/invitation-tracking.js';
import { UserBehavioralData } from '@/models/entities/user-behavioral-data.js';
import { UserAlgorithmProfile } from '@/models/entities/user-algorithm-profile.js';
import { ContentAlgorithmFeatures } from '@/models/entities/content-algorithm-features.js';
import { TimelineCache } from '@/models/entities/timeline-cache.js';
import { AlgorithmExperiment } from '@/models/entities/algorithm-experiment.js';
import { UserAlgorithmExperiment } from '@/models/entities/user-algorithm-experiment.js';
import { NoteView } from '@/models/entities/note-view.js';
import { BarktresScore } from '@/models/entities/barktres-score.js';
import { QuickBark } from '@/models/entities/quick-bark.js';
import { QuickBarkView } from '@/models/entities/quick-bark-view.js';
import { StripeEvent } from '@/models/entities/stripe-event.js';
import { WebhookEvent } from '@/models/entities/webhook-event.js';
import { SecurityEvent } from '@/models/entities/security-event.js';
import { IpBan } from '@/models/entities/ip-ban.js';

import { entities as charts } from '@/services/chart/entities.js';
import { envOption } from '../env.js';
import { dbLogger } from './logger.js';
import { redisClient } from './redis.js';

const sqlLogger = dbLogger.createSubLogger('sql', 'gray', false);

class MyCustomLogger implements Logger {
	private highlight(sql: string) {
		return highlight.highlight(sql, {
			language: 'sql', ignoreIllegals: true,
		});
	}

	public logQuery(query: string, parameters?: any[]) {
		sqlLogger.info(this.highlight(query).substring(0, 100));
	}

	public logQueryError(error: string, query: string, parameters?: any[]) {
		sqlLogger.error(this.highlight(query));
	}

	public logQuerySlow(time: number, query: string, parameters?: any[]) {
		sqlLogger.warn(this.highlight(query));
	}

	public logSchemaBuild(message: string) {
		sqlLogger.info(message);
	}

	public log(message: string) {
		sqlLogger.info(message);
	}

	public logMigration(message: string) {
		sqlLogger.info(message);
	}
}

export const entities = [
	Announcement,
	AnnouncementRead,
	Meta,
	Instance,
	App,
	AuthSession,
	AccessToken,
	User,
	UserProfile,
	UserKeypair,
	UserPublickey,
	UserList,
	UserListJoining,
	UserGroup,
	UserGroupJoining,
	UserGroupInvitation,
	UserNotePining,
	UserSecurityKey,
	UsedUsername,
	AttestationChallenge,
	Following,
	FollowRequest,
	Muting,
	Blocking,
	Note,
	NoteFavorite,
	NoteReaction,
	NoteWatching,
	NoteThreadMuting,
	NoteUnread,
	Page,
	PageLike,
	GalleryPost,
	GalleryLike,
	DriveFile,
	DriveFolder,
	Poll,
	PollVote,
	Notification,
	Emoji,
	Decoration,
	Streams,
	Hashtag,
	SwSubscription,
	AbuseUserReport,
	RegistrationTicket,
	MessagingMessage,
	MessagingMessageReaction,
	UserEncryptionKey,
	MessageEncryptionKey,
	UserEncryptionPreference,
	Signin,
	ModerationLog,
	Clip,
	ClipNote,
	Antenna,
	AntennaNote,
	PromoNote,
	PromoRead,
	Relay,
	MutedNote,
	Channel,
	ChannelFollowing,
	ChannelNotePining,
	RegistryItem,
	Ad,
	PasswordResetRequest,
	UserPending,
	Webhook,
	UserIp,
	GiftedSubscription,
	LiveChatMessage,
	StreamModerators,
	UserMusicIntegration,
	ContactImport,
	FirebaseToken,
	NotificationSchedule,
	InvitationTracking,
	UserBehavioralData,
	UserAlgorithmProfile,
	ContentAlgorithmFeatures,
	TimelineCache,
	AlgorithmExperiment,
	UserAlgorithmExperiment,
	NoteView,
	BarktresScore,
	QuickBark,
	QuickBarkView,
	StripeEvent,
	WebhookEvent,
	SecurityEvent,
	IpBan,
	...charts,
];

const log = process.env.NODE_ENV !== 'production';

export const db = new DataSource({
	type: 'postgres',
	host: config.db.host,
	port: config.db.port,
	username: config.db.user,
	password: config.db.pass,
	database: config.db.db,
	extra: {
		statement_timeout: 1000 * 10,
		...config.db.extra,
	},
	synchronize: process.env.NODE_ENV === 'test',
	dropSchema: process.env.NODE_ENV === 'test',
	cache: !config.db.disableCache ? {
		type: 'ioredis',
		options: {
			host: config.redis.host,
			port: config.redis.port,
			family: config.redis.family == null ? 0 : config.redis.family,
			password: config.redis.pass,
			keyPrefix: `${config.redis.prefix}:query:`,
			db: config.redis.db || 0,
		},
	} : false,
	logging: log,
	logger: log ? new MyCustomLogger() : undefined,
	maxQueryExecutionTime: 300,
	entities: entities,
	migrations: ['../../migration/*.js'],
});

export async function initDb(force = false) {
	if (force) {
		if (db.isInitialized) {
			await db.destroy();
		}
		await db.initialize();
		return;
	}

	if (db.isInitialized) {
		// nop
	} else {
		await db.initialize();
	}
}

export async function resetDb() {
	const reset = async () => {
		await redisClient.flushdb();
		// Clear all tables using TypeORM's truncate functionality - no raw SQL needed
		// This is safer than raw SQL and uses proper ORM methods
		await db.query(`
			TRUNCATE TABLE
				abuse_user_report, access_token, announcement, announcement_read,
				antenna, antenna_note, app, auth_session, blocking,
				channel, channel_following, channel_note_pining, clip, clip_note,
				contact_import, decoration, drive_file, drive_folder,
				emoji, federation_instance, firebase_token, following,
				follow_request, gallery_like, gallery_post, gift_card,
				gifted_subscription, hashtag, invitation_tracking,
				ip_ban,
				live_chat_message, messaging_message, messaging_message_reaction,
				meta, moderation_log, muted_note, muting, note,
				note_favorite, note_reaction, note_thread_muting, note_unread,
				note_view, note_watching, notification, notification_schedule,
				password_reset_request, poll, poll_vote, promo_note, promo_read,
				registry, relay, security_event, signin, stripe_event, stream_moderators,
				sw_subscription, timeline_cache, used_username, user,
				user_algorithm_experiment, user_algorithm_profile, user_behavioral_data,
				user_group, user_group_invitation, user_group_joining, user_ip,
				user_keypair, user_list, user_list_joining, user_music_integration,
				user_note_pining, user_pending, user_profile, user_publickey,
				user_security_key, webhook, webhook_event CASCADE
		`);
	};

	for (let i = 1; i <= 3; i++) {
		try {
			await reset();
		} catch (e) {
			if (i === 3) {
				throw e;
			} else {
				await new Promise(resolve => setTimeout(resolve, 1000));
				continue;
			}
		}
		break;
	}
}
