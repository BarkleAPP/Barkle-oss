import Bull from 'bull';
import * as fs from 'node:fs';
import archiver from 'archiver';
import { queueLogger } from '../../logger.js';
import { addFile } from '@/services/drive/add-file.js';
import { sendEmail } from '@/services/send-email.js';
import { format as dateFormat } from 'date-fns';
import { createTemp } from '@/misc/create-temp.js';
import { 
	Users, 
	UserProfiles, 
	Notes, 
	Followings, 
	Mutings, 
	Blockings, 
	UserLists, 
	UserListJoinings,
	DriveFiles,
	NoteFavorites,
	NoteReactions,
	Notifications,
	UserKeypairs,
	UserPublickeys,
	AuthSessions,
	Apps,
	AccessTokens,
	Signins,
	UserIps,
	MessagingMessages,
	UserNotePinings,
	Clips,
	ClipNotes,
	AbuseUserReports,
	Pages,
	PageLikes,
	GalleryPosts,
	GalleryLikes,
	ChannelFollowings
} from '@/models/index.js';
import { DbUserDataExportJobData } from '@/queue/types.js';
import { getFullApAccount } from '@/misc/convert-host.js';
import { MoreThan } from 'typeorm';

const logger = queueLogger.createSubLogger('export-user-data');

export async function exportUserData(job: Bull.Job<DbUserDataExportJobData>, done: any): Promise<void> {
	logger.info(`Exporting complete user data of ${job.data.user.id} ...`);

	const user = await Users.findOneBy({ id: job.data.user.id });
	if (user == null) {
		done();
		return;
	}

	// Create temp file
	const [path, cleanup] = await createTemp();
	logger.info(`Temp file is ${path}`);

	try {
		const exportData: any = {};

		// Basic user information
		logger.info('Collecting basic user information...');
		const profile = await UserProfiles.findOneBy({ userId: user.id });
		
		exportData.user = {
			id: user.id,
			username: user.username,
			name: user.name,
			createdAt: user.createdAt,
			updatedAt: user.updatedAt,
			lastActiveDate: user.lastActiveDate,
			followersCount: user.followersCount,
			followingCount: user.followingCount,
			notesCount: user.notesCount,
			tags: user.tags,
			isLocked: user.isLocked,
			isBot: user.isBot,
			isVerified: user.isVerified,
			isStaff: user.isStaff,
			isTranslator: user.isTranslator,
			isPlus: user.isPlus,
			isMPlus: user.isMPlus,
			isOG: user.isOG,
			isCat: user.isCat,
			showTimelineReplies: user.showTimelineReplies,
			avatarDecorations: user.avatarDecorations,
			subscriptionStatus: user.subscriptionStatus,
			subscriptionEndDate: user.subscriptionEndDate,
			barklePlusCredits: user.barklePlusCredits,
			miniPlusCredits: user.miniPlusCredits,
			barklePlusCreditsExpiry: user.barklePlusCreditsExpiry,
			miniPlusCreditsExpiry: user.miniPlusCreditsExpiry,
		};

		if (profile) {
			exportData.profile = {
				location: profile.location,
				birthday: profile.birthday,
				description: profile.description,
				fields: profile.fields,
				lang: profile.lang,
				url: profile.url,
				email: job.data.includePrivateData ? profile.email : null,
				emailVerified: profile.emailVerified,
				emailNotificationTypes: profile.emailNotificationTypes,
				publicReactions: profile.publicReactions,
				ffVisibility: profile.ffVisibility,
				twoFactorEnabled: profile.twoFactorEnabled,
				securityKeysAvailable: profile.securityKeysAvailable,
				usePasswordLessLogin: profile.usePasswordLessLogin,
				autoAcceptFollowed: profile.autoAcceptFollowed,
				noCrawle: profile.noCrawle,
				alwaysMarkNsfw: profile.alwaysMarkNsfw,
				autoSensitive: profile.autoSensitive,
				carefulBot: profile.carefulBot,
				injectFeaturedNote: profile.injectFeaturedNote,
				receiveAnnouncementEmail: profile.receiveAnnouncementEmail,
				integrations: profile.integrations,
				mutedWords: job.data.includePrivateData ? profile.mutedWords : null,
				mutedInstances: job.data.includePrivateData ? profile.mutedInstances : null,
				mutingNotificationTypes: job.data.includePrivateData ? profile.mutingNotificationTypes : null,
			};
		}

		// Export notes
		logger.info('Collecting notes...');
		let notesCount = 0;
		let notesCursor: string | null = null;
		exportData.notes = [];

		while (true) {
			const notes = await Notes.find({
				where: {
					userId: user.id,
					...(notesCursor ? { id: MoreThan(notesCursor) } : {}),
				},
				take: 100,
				order: { id: 1 },
			});

			if (notes.length === 0) break;
			notesCursor = notes[notes.length - 1].id;

			for (const note of notes) {
				exportData.notes.push({
					id: note.id,
					createdAt: note.createdAt,
					text: note.text,
					cw: note.cw,
					visibility: note.visibility,
					localOnly: note.localOnly,
					reactions: note.reactions,
					repliesCount: note.repliesCount,
					renoteCount: note.renoteCount,
					tags: note.tags,
					hasPoll: note.hasPoll,
					threadId: note.threadId,
					replyId: note.replyId,
					renoteId: note.renoteId,
					uri: note.uri,
					url: note.url,
				});
				notesCount++;
			}

			job.progress((notesCount / user.notesCount) * 30); // 30% of progress for notes
		}

		// Export following
		logger.info('Collecting following...');
		const following = await Followings.find({ where: { followerId: user.id } });
		const followingUsers = await Users.findByIds(following.map((f: any) => f.followeeId));
		exportData.following = followingUsers.map(u => ({
			id: u.id,
			username: u.username,
			name: u.name,
			host: u.host,
			acct: getFullApAccount(u.username, u.host),
			createdAt: following.find((f: any) => f.followeeId === u.id)?.createdAt,
		}));

		// Export followers  
		logger.info('Collecting followers...');
		const followers = await Followings.find({ where: { followeeId: user.id } });
		const followerUsers = await Users.findByIds(followers.map(f => f.followerId));
		exportData.followers = followerUsers.map(u => ({
			id: u.id,
			username: u.username,
			name: u.name,
			host: u.host,
			acct: getFullApAccount(u.username, u.host),
			createdAt: followers.find(f => f.followerId === u.id)?.createdAt,
		}));

		// Export user lists
		logger.info('Collecting user lists...');
		const userLists = await UserLists.find({ where: { userId: user.id } });
		exportData.userLists = [];
		
		for (const list of userLists) {
			const listMembers = await UserListJoinings.find({ where: { userListId: list.id } });
			const memberUsers = await Users.findByIds(listMembers.map(m => m.userId));
			
			exportData.userLists.push({
				id: list.id,
				name: list.name,
				createdAt: list.createdAt,
				members: memberUsers.map(u => ({
					id: u.id,
					username: u.username,
					name: u.name,
					host: u.host,
					acct: getFullApAccount(u.username, u.host),
				}))
			});
		}

		// Export favorites
		logger.info('Collecting favorites...');
		const favorites = await NoteFavorites.find({ 
			where: { userId: user.id },
			order: { id: 'DESC' },
			take: 1000
		});
		exportData.favorites = favorites.map(f => ({
			id: f.id,
			createdAt: f.createdAt,
			noteId: f.noteId,
		}));

		// Export reactions
		logger.info('Collecting reactions...');
		const reactions = await NoteReactions.find({ 
			where: { userId: user.id },
			order: { id: 'DESC' },
			take: 1000
		});
		exportData.reactions = reactions.map(r => ({
			id: r.id,
			createdAt: r.createdAt,
			noteId: r.noteId,
			reaction: r.reaction,
		}));

		// Export pinned notes
		logger.info('Collecting pinned notes...');
		const pinnedNotes = await UserNotePinings.find({ where: { userId: user.id } });
		exportData.pinnedNotes = pinnedNotes.map(p => ({
			id: p.id,
			createdAt: p.createdAt,
			noteId: p.noteId,
		}));

		// Export drive files
		logger.info('Collecting drive files...');
		let filesCount = 0;
		let filesCursor: string | null = null;
		exportData.driveFiles = [];

		while (true) {
			const files = await DriveFiles.find({
				where: {
					userId: user.id,
					...(filesCursor ? { id: MoreThan(filesCursor) } : {}),
				},
				take: 100,
				order: { id: 1 },
			});

			if (files.length === 0) break;
			filesCursor = files[files.length - 1].id;

			for (const file of files) {
				exportData.driveFiles.push({
					id: file.id,
					createdAt: file.createdAt,
					name: file.name,
					type: file.type,
					md5: file.md5,
					size: file.size,
					url: file.url,
					thumbnailUrl: file.thumbnailUrl,
					comment: file.comment,
					properties: file.properties,
					storedInternal: file.storedInternal,
					isLink: file.isLink,
					isSensitive: file.isSensitive,
				});
				filesCount++;
			}

			job.progress(60 + (filesCount / Math.max(filesCount, 100)) * 10); // 10% for files
		}

		// Export private data if requested
		if (job.data.includePrivateData) {
			// Export muted users
			logger.info('Collecting muted users...');
			const muted = await Mutings.find({ where: { muterId: user.id } });
			const mutedUsers = await Users.findByIds(muted.map(m => m.muteeId));
			exportData.mutedUsers = mutedUsers.map(u => ({
				id: u.id,
				username: u.username,
				name: u.name,
				host: u.host,
				acct: getFullApAccount(u.username, u.host),
				createdAt: muted.find(m => m.muteeId === u.id)?.createdAt,
			}));

			// Export blocked users
			logger.info('Collecting blocked users...');
			const blocked = await Blockings.find({ where: { blockerId: user.id } });
			const blockedUsers = await Users.findByIds(blocked.map(b => b.blockeeId));
			exportData.blockedUsers = blockedUsers.map(u => ({
				id: u.id,
				username: u.username,
				name: u.name,
				host: u.host,
				acct: getFullApAccount(u.username, u.host),
				createdAt: blocked.find(b => b.blockeeId === u.id)?.createdAt,
			}));

			// Export notifications (last 1000)
			logger.info('Collecting notifications...');
			const notifications = await Notifications.find({
				where: { notifieeId: user.id },
				order: { id: 'DESC' },
				take: 1000
			});
			exportData.notifications = notifications.map(n => ({
				id: n.id,
				createdAt: n.createdAt,
				type: n.type,
				isRead: n.isRead,
				notifierId: n.notifierId,
				noteId: n.noteId,
				reaction: n.reaction,
				choice: n.choice,
			}));

			// Export authorized applications
			logger.info('Collecting authorized apps...');
			const authSessions = await AuthSessions.find({ where: { userId: user.id } });
			const appIds = [...new Set(authSessions.map(s => s.appId))];
			const apps = await Apps.findByIds(appIds);
			exportData.authorizedApps = apps.map(app => ({
				id: app.id,
				name: app.name,
				description: app.description,
				permission: app.permission,
				createdAt: app.createdAt,
				lastUsed: authSessions.find(s => s.appId === app.id)?.createdAt,
			}));

			// Export sign-in history (last 100)
			logger.info('Collecting sign-in history...');
			const signins = await Signins.find({
				where: { userId: user.id },
				order: { id: 'DESC' },
				take: 100
			});
			exportData.signInHistory = signins.map(s => ({
				id: s.id,
				createdAt: s.createdAt,
				ip: s.ip,
				success: s.success,
			}));

			// Export messaging conversations
			logger.info('Collecting messages...');
			const messages = await MessagingMessages.find({
				where: [
					{ userId: user.id },
					{ recipientId: user.id }
				],
				order: { createdAt: 'DESC' },
				take: 1000
			});
			exportData.messages = messages.map(m => ({
				id: m.id,
				createdAt: m.createdAt,
				text: m.text,
				userId: m.userId,
				recipientId: m.recipientId,
				groupId: m.groupId,
				fileId: m.fileId,
				isRead: m.isRead,
			}));
		}

		// Export pages
		logger.info('Collecting pages...');
		const pages = await Pages.find({ where: { userId: user.id } });
		exportData.pages = pages.map(p => ({
			id: p.id,
			createdAt: p.createdAt,
			updatedAt: p.updatedAt,
			title: p.title,
			name: p.name,
			summary: p.summary,
			content: p.content,
			variables: p.variables,
			script: p.script,
			isPublic: p.isPublic,
			likedCount: p.likedCount,
		}));

		// Export gallery posts
		logger.info('Collecting gallery posts...');
		const galleryPosts = await GalleryPosts.find({ where: { userId: user.id } });
		exportData.galleryPosts = galleryPosts.map(g => ({
			id: g.id,
			createdAt: g.createdAt,
			updatedAt: g.updatedAt,
			title: g.title,
			description: g.description,
			fileIds: g.fileIds,
			isSensitive: g.isSensitive,
			likedCount: g.likedCount,
			tags: g.tags,
		}));

		// Export channel followings
		logger.info('Collecting channel followings...');
		const channelFollowings = await ChannelFollowings.find({ where: { followerId: user.id } });
		exportData.channelFollowings = channelFollowings.map(c => ({
			id: c.id,
			createdAt: c.createdAt,
			followeeId: c.followeeId,
		}));

		// Add metadata
		exportData.exportInfo = {
			exportedAt: new Date(),
			exportedBy: user.id,
			version: '1.0',
			includePrivateData: job.data.includePrivateData,
			format: job.data.format,
			totalNotes: exportData.notes.length,
			totalFollowing: exportData.following.length,
			totalFollowers: exportData.followers.length,
			totalUserLists: exportData.userLists.length,
			totalDriveFiles: exportData.driveFiles.length,
		};

		job.progress(90);

		// Write the data to JSON file
		const content = JSON.stringify(exportData, null, 2);
		fs.writeFileSync(path, content, 'utf-8');

		logger.succ(`Exported to: ${path}`);

		// Create ZIP archive
		const [zipPath, zipCleanup] = await createTemp();
		const zipStream = fs.createWriteStream(zipPath);
		const archive = archiver('zip', {
			zlib: { level: 9 }, // Maximum compression for security
		});

		logger.info('Creating zip archive...');

		archive.on('error', (err) => {
			logger.error('Archive error:', err);
			throw err;
		});

		archive.pipe(zipStream);

		const fileName = `user-data-export-${user.username}-${dateFormat(new Date(), 'yyyy-MM-dd-HH-mm-ss')}.json`;
		
		// Add the JSON file to the archive
		archive.file(path, { name: fileName });

		// Finalize the archive
		await new Promise<void>((resolve, reject) => {
			zipStream.on('close', () => {
				logger.succ(`Archive created: ${zipPath} (${archive.pointer()} bytes)`);
				resolve();
			});
			
			zipStream.on('error', reject);
			archive.on('error', reject);
			
			archive.finalize();
		});

		// Upload to drive
		const zipFileName = `user-data-export-${user.username}-${dateFormat(new Date(), 'yyyy-MM-dd-HH-mm-ss')}.zip`;
		const driveFile = await addFile({ user, path: zipPath, name: zipFileName, force: true });

		logger.succ(`Exported to drive file: ${driveFile.id}`);

		// Get user profile for email
		const userProfile = await UserProfiles.findOneBy({ userId: user.id });
		
		if (userProfile?.email) {
			logger.info('Sending export email to user...');
			
			try {
				const subject = 'Your Data Export is Ready';
				const text = `Hello ${user.name || user.username},

Your data export has been completed and is ready for download.

Export Details:
- Export Date: ${exportData.exportInfo.exportedAt}
- Total Notes: ${exportData.exportInfo.totalNotes}
- Total Following: ${exportData.exportInfo.totalFollowing}
- Total Followers: ${exportData.exportInfo.totalFollowers}
- Total Drive Files: ${exportData.exportInfo.totalDriveFiles}
- Private Data Included: ${job.data.includePrivateData ? 'Yes' : 'No'}

You can download your export from your Drive files. The file will be available for 30 days.

For security reasons, this export contains sensitive information and should be handled carefully.

Best regards,
The Barkle Team`;

				const html = `
					<p>Hello <strong>${user.name || user.username}</strong>,</p>
					
					<p>Your data export has been completed and is ready for download.</p>
					
					<h3>Export Details:</h3>
					<ul>
						<li><strong>Export Date:</strong> ${exportData.exportInfo.exportedAt}</li>
						<li><strong>Total Notes:</strong> ${exportData.exportInfo.totalNotes}</li>
						<li><strong>Total Following:</strong> ${exportData.exportInfo.totalFollowing}</li>
						<li><strong>Total Followers:</strong> ${exportData.exportInfo.totalFollowers}</li>
						<li><strong>Total Drive Files:</strong> ${exportData.exportInfo.totalDriveFiles}</li>
						<li><strong>Private Data Included:</strong> ${job.data.includePrivateData ? 'Yes' : 'No'}</li>
					</ul>
					
					<p>You can download your export from your <strong>Drive files</strong>. The file will be available for 30 days.</p>
					
					<div style="padding: 16px; background-color: #fffbf0; border: 1px solid #ffd33d; border-radius: 4px; margin: 16px 0;">
						<strong>⚠️ Security Notice:</strong> This export contains sensitive information and should be handled carefully. 
						Do not share this file with unauthorized parties.
					</div>
					
					<p>Best regards,<br>The Barkle Team</p>
				`;

				await sendEmail(userProfile.email, subject, html, text);
				logger.succ(`Export notification email sent to: ${userProfile.email}`);
			} catch (emailError) {
				logger.error('Failed to send export notification email:', emailError as Error);
				// Don't fail the entire job if email fails
			}
		} else {
			logger.warn('No email address found for user, skipping email notification');
		}

		// Clean up temporary files
		zipCleanup();
	} finally {
		cleanup();
	}

	job.progress(100);
	done();
}
