export type QuickBark = {
    id: string;
    createdAt: string;
    userId: string;
    user: any; // TODO: Import proper User type
    content: string | null;
    type: 'text' | 'image' | 'video' | 'gif';
    expiresAt: string;
    sharedNoteId: string | null;
    sharedNote?: any; // TODO: Import proper Note type
    fileId: string | null;
    file?: any; // TODO: Import proper DriveFile type
};
