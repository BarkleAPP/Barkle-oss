import { publishMainStream, publishUserEvent } from '@/services/stream.js';
import createFollowRequest from './requests/create.js';
import Logger from '../logger.js';
import { IdentifiableError } from '@/misc/identifiable-error.js';
import { User } from '@/models/entities/user.js';
import { Followings, Users, FollowRequests, Blockings, UserProfiles } from '@/models/index.js';
import { perUserFollowingChart } from '@/services/chart/index.js';
import { genId } from '@/misc/gen-id.js';
import { createNotification } from '../create-notification.js';
import { isDuplicateKeyValueError } from '@/misc/is-duplicate-key-value-error.js';
import { Packed } from '@/misc/schema.js';
import { getActiveWebhooks } from '@/misc/webhook-cache.js';
import { webhookDeliver } from '@/queue/index.js';
import { PositiveReinforcementService } from '../positive-reinforcement.js';
import { ViralGrowthService } from '../viral-growth.js';
// Removed social network service dependency

const logger = new Logger('following/create');

export async function insertFollowingDoc(followee: { id: User['id'] }, follower: { id: User['id'] }, fromInvitation: boolean = false) {
    if (follower.id === followee.id) return;

    let alreadyFollowed = false;

    await Followings.insert({
        id: genId(),
        createdAt: new Date(),
        followerId: follower.id,
        followeeId: followee.id,
    }).catch(e => {
        if (isDuplicateKeyValueError(e)) {
            logger.info(`Insert duplicated ignore. ${follower.id} => ${followee.id}`);
            alreadyFollowed = true;
        } else {
            throw e;
        }
    });

    const req = await FollowRequests.findOneBy({
        followeeId: followee.id,
        followerId: follower.id,
    });

    if (req) {
        await FollowRequests.delete({
            followeeId: followee.id,
            followerId: follower.id,
        });

        createNotification(follower.id, 'followRequestAccepted', {
            notifierId: followee.id,
        });
    }

    if (alreadyFollowed) return;

    await Promise.all([
        Users.increment({ id: follower.id }, 'followingCount', 1),
        Users.increment({ id: followee.id }, 'followersCount', 1),
    ]);

    perUserFollowingChart.update(follower, followee, true);

    Users.pack(followee.id, follower, {
        detail: true,
    }).then(async packed => {
        publishUserEvent(follower.id, 'follow', packed as Packed<"UserDetailedNotMe">);
        publishMainStream(follower.id, 'follow', packed as Packed<"UserDetailedNotMe">);

        const webhooks = (await getActiveWebhooks()).filter(x => x.userId === follower.id && x.on.includes('follow'));
        for (const webhook of webhooks) {
            webhookDeliver(webhook, 'follow', {
                user: packed,
            });
        }
    });

    Users.pack(follower.id, followee).then(async packed => {
        publishMainStream(followee.id, 'followed', packed);

        const webhooks = (await getActiveWebhooks()).filter(x => x.userId === followee.id && x.on.includes('followed'));
        for (const webhook of webhooks) {
            webhookDeliver(webhook, 'followed', {
                user: packed,
            });
        }
    });

    createNotification(followee.id, 'follow', {
        notifierId: follower.id,
    });

    // Check for positive reinforcement milestones for the followee (person being followed)
    setImmediate(async () => {
        try {
            const milestone = await PositiveReinforcementService.detectMilestone(
                followee.id, 
                'followerGained'
            );
            if (milestone) {
                await PositiveReinforcementService.sendPositiveReinforcement(milestone);
            }
        } catch (error) {
            console.error('Error in positive reinforcement milestone detection:', error);
        }
    });

    // Enhance with viral growth tracking and amplification
    setImmediate(async () => {
        try {
            await ViralGrowthService.enhanceFollowingCreation(
                follower.id,
                followee.id,
                fromInvitation
            );
        } catch (error) {
            console.error('Error in viral growth enhancement:', error);
        }
    });

    // Update social network graph cache
    setImmediate(async () => {
        // Social network graph updates removed for simplicity
    });
}

export default async function(_follower: { id: User['id'] }, _followee: { id: User['id'] }, fromInvitation: boolean = false) {
    const [follower, followee] = await Promise.all([
        Users.findOneByOrFail({ id: _follower.id }),
        Users.findOneByOrFail({ id: _followee.id }),
    ]);

    const [blocking, blocked] = await Promise.all([
        Blockings.findOneBy({
            blockerId: follower.id,
            blockeeId: followee.id,
        }),
        Blockings.findOneBy({
            blockerId: followee.id,
            blockeeId: follower.id,
        }),
    ]);

    if (blocking != null) throw new IdentifiableError('710e8fb0-b8c3-4922-be49-d5d93d8e6a6e', 'blocking');
    if (blocked != null) throw new IdentifiableError('3338392a-f764-498d-8855-db939dcf8c48', 'blocked');

    const followeeProfile = await UserProfiles.findOneByOrFail({ userId: followee.id });

    if (followee.isLocked || (followeeProfile.carefulBot && follower.isBot)) {
        let autoAccept = false;

        const following = await Followings.findOneBy({
            followerId: follower.id,
            followeeId: followee.id,
        });
        if (following) {
            autoAccept = true;
        }

        if (!autoAccept && followeeProfile.autoAcceptFollowed) {
            const followed = await Followings.findOneBy({
                followerId: followee.id,
                followeeId: follower.id,
            });

            if (followed) autoAccept = true;
        }

        if (!autoAccept) {
            await createFollowRequest(follower, followee);
            return;
        }
    }

    await insertFollowingDoc(followee, follower, fromInvitation);
}
