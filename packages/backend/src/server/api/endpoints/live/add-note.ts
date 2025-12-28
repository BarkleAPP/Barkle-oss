import { Streams, Notes } from '@/models/index.js';
import { fetchMeta } from '@/misc/fetch-meta.js';
import { ApiError } from '../../error.js';
import define from '../../define.js';

export const meta = {
    tags: ['stream'],
    requireCredential: true,
    requireCredentialPrivateMode: true,
    res: {
        type: 'object',
        optional: false,
        nullable: false,
        properties: {
            id: { type: 'string' },
            noteId: { type: 'string' },
            title: { type: 'string' }
        }
    },
    errors: {
        noStream: {
            message: 'You do not have an active stream.',
            code: 'NO_STREAM',
            id: '7c3e8e52-9a1b-4d1c-9b5a-8f1c5b7d4e3a'
        },
        noSuchNote: {
            message: 'Note not found or you do not have permission.',
            code: 'NO_SUCH_NOTE',
            id: '8d4f9e63-0b2c-4d1d-9c6a-9g2h3i4j5k6l'
        }
    }
} as const;

export const paramDef = {
    type: 'object',
    properties: {
        noteInput: { type: 'string', minLength: 1 }
    },
    required: ['noteInput']
} as const;

function extractNoteId(input: string): string {
    // Handle direct IDs
    if (!input.includes('/')) return input;
    
    // Handle URLs
    const matches = input.match(/\/(notes|barks)\/([a-zA-Z0-9]+)/);
    if (!matches) return input;
    
    return matches[2];
}

export default define(meta, paramDef, async (ps, user) => {
    // Get instance info
    const instance = await fetchMeta();

    // Extract note ID from input (could be a URL or direct ID)
    const noteId = extractNoteId(ps.noteInput);

    // Verify note exists and belongs to user
    const note = await Notes.findOneBy({ id: noteId });
    if (!note || note.userId !== user.id) {
        throw new ApiError(meta.errors.noSuchNote);
    }

    // Find the user's stream
    const stream = await Streams.findOneBy({ userId: user.id });
    if (!stream) {
        throw new ApiError(meta.errors.noStream);
    }

    // Update the stream with the new noteId
    await Streams.update({ id: stream.id }, {
        noteId: noteId,
        updatedAt: new Date()
    });

    // Return the updated stream details
    return {
        id: stream.id,
        noteId: noteId,
        title: stream.title
    };
});