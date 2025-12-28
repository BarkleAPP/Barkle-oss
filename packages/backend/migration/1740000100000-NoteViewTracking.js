/**
 * Migration: Note View Tracking System
 * 
 * Adds view tracking for algorithm improvements
 * Tracks dwell time, scroll depth, position, source, engagement
 */
export class NoteViewTracking1740000100000 {
    name = 'NoteViewTracking1740000100000'

    async up(queryRunner) {
        // Create note_view table
        await queryRunner.query(`
            CREATE TABLE "note_view" (
                "id" character varying(32) NOT NULL,
                "noteId" character varying(32) NOT NULL,
                "userId" character varying(32) NOT NULL,
                "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "dwellTimeMs" integer NOT NULL DEFAULT 0,
                "scrollDepth" numeric(3,2),
                "position" integer,
                "source" character varying(50),
                "didEngage" boolean NOT NULL DEFAULT false,
                "sessionId" character varying(32),
                "metadata" jsonb NOT NULL DEFAULT '{}',
                CONSTRAINT "PK_note_view" PRIMARY KEY ("id"),
                CONSTRAINT "FK_note_view_noteId" 
                    FOREIGN KEY ("noteId") REFERENCES "note"("id") ON DELETE CASCADE,
                CONSTRAINT "FK_note_view_userId" 
                    FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE
            )
        `);

        // Create indexes for efficient querying
        await queryRunner.query(`CREATE INDEX "IDX_note_view_noteId" ON "note_view" ("noteId")`);
        await queryRunner.query(`CREATE INDEX "IDX_note_view_userId" ON "note_view" ("userId")`);
        await queryRunner.query(`CREATE INDEX "IDX_note_view_noteId_userId" ON "note_view" ("noteId", "userId")`);
        await queryRunner.query(`CREATE INDEX "IDX_note_view_userId_createdAt" ON "note_view" ("userId", "createdAt")`);
        await queryRunner.query(`CREATE INDEX "IDX_note_view_noteId_createdAt" ON "note_view" ("noteId", "createdAt")`);
    }

    async down(queryRunner) {
        // Drop indexes
        await queryRunner.query(`DROP INDEX "IDX_note_view_noteId_createdAt"`);
        await queryRunner.query(`DROP INDEX "IDX_note_view_userId_createdAt"`);
        await queryRunner.query(`DROP INDEX "IDX_note_view_noteId_userId"`);
        await queryRunner.query(`DROP INDEX "IDX_note_view_userId"`);
        await queryRunner.query(`DROP INDEX "IDX_note_view_noteId"`);

        // Drop table
        await queryRunner.query(`DROP TABLE "note_view"`);
    }
}
