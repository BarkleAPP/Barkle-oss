import define from '../../define.js';
import { ContactInferenceService } from '@/services/contact-inference-service.js';
import { Users } from '@/models/index.js';

export const meta = {
    tags: ['contacts', 'users', 'recommendations'],
    requireCredential: true,
    kind: 'read:account',

    description: 'Get friend recommendations based on inferred contact patterns',

    res: {
        type: 'array',
        optional: false,
        nullable: false,
        items: {
            type: 'object',
            optional: false,
            nullable: false,
            properties: {
                user: {
                    type: 'object',
                    optional: false,
                    nullable: false,
                    ref: 'UserLite',
                },
                confidence: {
                    type: 'number',
                    optional: false,
                    nullable: false,
                },
                reason: {
                    type: 'string',
                    optional: false,
                    nullable: false,
                },
                sourceCount: {
                    type: 'number',
                    optional: false,
                    nullable: false,
                },
            },
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
            default: 20,
        },
    },
    required: [],
} as const;

export default define(meta, paramDef, async (ps, user) => {
    // Get inferred friend recommendations
    const recommendations = await ContactInferenceService.getInferredFriendRecommendations(
        user.id,
        ps.limit,
    );

    // Pack users
    const results = [];
    for (const rec of recommendations) {
        const recommendedUser = await Users.findOneBy({ id: rec.userId });
        if (!recommendedUser) continue;

        const packed = await Users.pack(recommendedUser, user, { detail: false });

        results.push({
            user: packed,
            confidence: rec.confidence,
            reason: rec.reason,
            sourceCount: rec.sourceCount,
        });
    }

    return results;
});
