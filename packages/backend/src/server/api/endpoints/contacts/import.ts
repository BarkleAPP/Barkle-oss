import define from '../../define.js';
import { ContactService } from '@/services/contact-service.js';
import { SocialGraphSpiderWebService } from '@/services/social-graph-spider-web.js';

export const meta = {
    tags: ['contacts', 'growth'],
    requireCredential: true,
    kind: 'write:contacts',
    limit: { duration: 60 * 60 * 1000, max: 200 }, // 100 imports per hour
    description: 'Import contacts and find matches with existing Barkle users',

    res: {
        type: 'object',
        optional: false,
        nullable: false,
        properties: {
            imported: {
                type: 'integer',
                optional: false,
                nullable: false,
                description: 'Number of contacts imported',
            },
            matches: {
                type: 'integer',
                optional: false,
                nullable: false,
                description: 'Number of contacts that matched existing Barkle users',
            },
        },
    },
} as const;

export const paramDef = {
    type: 'object',
    properties: {
        contacts: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    identifier: {
                        type: 'string',
                        description: 'Contact identifier (phone number or email)',
                    },
                    name: {
                        type: 'string',
                        nullable: true,
                        description: 'Contact display name',
                    },
                },
                required: ['identifier'],
            },
            maxItems: 1000,
            minItems: 1,
            description: 'Array of contacts to import',
        },
    },
    required: ['contacts'],
} as const;

export default define(meta, paramDef, async (ps, user) => {
    // Additional validation and rate limiting
    const contactCount = ps.contacts.length;

    // Prevent abuse: limit to 1000 contacts per import, but allow more frequent smaller imports
    if (contactCount > 1000) {
        throw new Error('Too many contacts. Maximum 1000 contacts per import.');
    }

    // For large imports (>500 contacts), add a small delay to prevent rapid-fire requests
    if (contactCount > 500) {
        await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second delay
    }

    const contactService = new ContactService();

    // Import contacts and find matches
    const contacts: Array<{ identifier: string; name?: string }> = ps.contacts.map(contact => ({
        identifier: contact.identifier,
        name: contact.name || undefined,
    }));

    const matches = await contactService.importAndMatchContacts(user.id, contacts);

    // Log successful import for monitoring
    console.log(`[ContactImport] User ${user.id} imported ${contactCount} contacts, found ${matches.length} matches`);

    // Build spider web social graph after import (async, don't block response)
    Promise.resolve().then(async () => {
        try {
            await SocialGraphSpiderWebService.rebuildAfterContactImport(user.id);
            await SocialGraphSpiderWebService.updateAlgorithmPreferencesWithSocialGraph(user.id);
        } catch (error) {
            console.error('[ContactImport] Failed to build spider web:', error);
        }
    });

    // TODO: Trigger friend discovery notifications when notification system is extended
    // if (matches.length > 0) {
    //   await createNotification(user.id, 'contactMatches', {
    //     matchCount: matches.length,
    //     matches: matches.slice(0, 3), // Show first 3 matches
    //   });
    // }

    return {
        imported: ps.contacts.length,
        matches: matches.length,
    };
});