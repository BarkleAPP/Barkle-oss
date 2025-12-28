export class CreateQuickBarksTables20251102000000 {
    name = 'CreateQuickBarksTables20251102000000'

    async up(queryRunner) {
        await queryRunner.query(`
            CREATE TABLE "quick_bark" (
                "id" character varying(32) NOT NULL,
                "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL,
                "userId" character varying(32) NOT NULL,
                "content" text,
                "type" character varying(16) NOT NULL,
                "expiresAt" TIMESTAMP WITH TIME ZONE NOT NULL,
                "sharedNoteId" character varying(32),
                "fileId" character varying(32),
                CONSTRAINT "PK_quick_bark" PRIMARY KEY ("id")
            )
        `);

        await queryRunner.query(`
            ALTER TABLE "quick_bark"
            ADD CONSTRAINT "FK_quick_bark_fileId"
            FOREIGN KEY ("fileId")
            REFERENCES "drive_file"("id")
            ON DELETE SET NULL
            ON UPDATE NO ACTION
        `);

        await queryRunner.query(`
            CREATE INDEX "IDX_quick_bark_createdAt" ON "quick_bark" ("createdAt")
        `);

        await queryRunner.query(`
            CREATE INDEX "IDX_quick_bark_userId" ON "quick_bark" ("userId")
        `);

        await queryRunner.query(`
            CREATE INDEX "IDX_quick_bark_expiresAt" ON "quick_bark" ("expiresAt")
        `);

        await queryRunner.query(`
            ALTER TABLE "quick_bark"
            ADD CONSTRAINT "FK_quick_bark_userId"
            FOREIGN KEY ("userId")
            REFERENCES "user"("id")
            ON DELETE CASCADE
            ON UPDATE NO ACTION
        `);

        await queryRunner.query(`
            ALTER TABLE "quick_bark"
            ADD CONSTRAINT "FK_quick_bark_sharedNoteId"
            FOREIGN KEY ("sharedNoteId")
            REFERENCES "note"("id")
            ON DELETE SET NULL
            ON UPDATE NO ACTION
        `);

        await queryRunner.query(`
            CREATE TABLE "quick_bark_view" (
                "id" character varying(32) NOT NULL,
                "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL,
                "quickBarkId" character varying(32) NOT NULL,
                "userId" character varying(32) NOT NULL,
                CONSTRAINT "PK_quick_bark_view" PRIMARY KEY ("id")
            )
        `);

        await queryRunner.query(`
            CREATE INDEX "IDX_quick_bark_view_createdAt" ON "quick_bark_view" ("createdAt")
        `);

        await queryRunner.query(`
            CREATE INDEX "IDX_quick_bark_view_quickBarkId" ON "quick_bark_view" ("quickBarkId")
        `);

        await queryRunner.query(`
            CREATE INDEX "IDX_quick_bark_view_userId" ON "quick_bark_view" ("userId")
        `);

        await queryRunner.query(`
            ALTER TABLE "quick_bark_view"
            ADD CONSTRAINT "FK_quick_bark_view_quickBarkId"
            FOREIGN KEY ("quickBarkId")
            REFERENCES "quick_bark"("id")
            ON DELETE CASCADE
            ON UPDATE NO ACTION
        `);

        await queryRunner.query(`
            ALTER TABLE "quick_bark_view"
            ADD CONSTRAINT "FK_quick_bark_view_userId"
            FOREIGN KEY ("userId")
            REFERENCES "user"("id")
            ON DELETE CASCADE
            ON UPDATE NO ACTION
        `);
    }

    async down(queryRunner) {
        await queryRunner.query(`
            ALTER TABLE "quick_bark_view"
            DROP CONSTRAINT IF EXISTS "FK_quick_bark_view_userId"
        `);

        await queryRunner.query(`
            ALTER TABLE "quick_bark_view"
            DROP CONSTRAINT IF EXISTS "FK_quick_bark_view_quickBarkId"
        `);

        await queryRunner.query(`
            DROP INDEX IF EXISTS "IDX_quick_bark_view_userId"
        `);

        await queryRunner.query(`
            DROP INDEX IF EXISTS "IDX_quick_bark_view_quickBarkId"
        `);

        await queryRunner.query(`
            DROP INDEX IF EXISTS "IDX_quick_bark_view_createdAt"
        `);

        await queryRunner.query(`
            DROP TABLE IF EXISTS "quick_bark_view"
        `);

        await queryRunner.query(`
            ALTER TABLE "quick_bark"
            DROP CONSTRAINT IF EXISTS "FK_quick_bark_sharedNoteId"
        `);

        await queryRunner.query(`
            ALTER TABLE "quick_bark"
            DROP CONSTRAINT IF EXISTS "FK_quick_bark_userId"
        `);

        await queryRunner.query(`
            DROP INDEX IF EXISTS "IDX_quick_bark_expiresAt"
        `);

        await queryRunner.query(`
            DROP INDEX IF EXISTS "IDX_quick_bark_userId"
        `);

        await queryRunner.query(`
            DROP INDEX IF EXISTS "IDX_quick_bark_createdAt"
        `);

        await queryRunner.query(`
            DROP TABLE IF EXISTS "quick_bark"
        `);
    }
}
