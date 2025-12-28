export class CreateLiveChatMessageTable1704067200000 {
    async up(queryRunner) {
        // Create LiveChatMessage table
        await queryRunner.query(`CREATE TABLE IF NOT EXISTS "live_chat_message" (
            "id" character varying(32) NOT NULL,
            "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL,
            "userId" character varying(32) NOT NULL,
            "streamId" character varying(32) NOT NULL,
            "text" character varying(3000) NOT NULL,
            "isDeleted" boolean NOT NULL DEFAULT false,
            "deletedAt" TIMESTAMP WITH TIME ZONE,
            "deletedBy" character varying(32),
            CONSTRAINT "PK_live_chat_message_id" PRIMARY KEY ("id")
        )`);

        // Create indexes
        await queryRunner.query(`CREATE INDEX "IDX_live_chat_message_createdAt" ON "live_chat_message" ("createdAt")`);
        await queryRunner.query(`CREATE INDEX "IDX_live_chat_message_userId" ON "live_chat_message" ("userId")`);
        await queryRunner.query(`CREATE INDEX "IDX_live_chat_message_streamId" ON "live_chat_message" ("streamId")`);

        // Add foreign key constraints
        await queryRunner.query(`ALTER TABLE "live_chat_message" ADD CONSTRAINT "FK_live_chat_message_userId" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "live_chat_message" ADD CONSTRAINT "FK_live_chat_message_streamId" FOREIGN KEY ("streamId") REFERENCES "streams"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "live_chat_message" ADD CONSTRAINT "FK_live_chat_message_deletedBy" FOREIGN KEY ("deletedBy") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    }

    async down(queryRunner) {
        // Drop foreign key constraints
        await queryRunner.query(`ALTER TABLE "live_chat_message" DROP CONSTRAINT IF EXISTS "FK_live_chat_message_deletedBy"`);
        await queryRunner.query(`ALTER TABLE "live_chat_message" DROP CONSTRAINT IF EXISTS "FK_live_chat_message_streamId"`);
        await queryRunner.query(`ALTER TABLE "live_chat_message" DROP CONSTRAINT IF EXISTS "FK_live_chat_message_userId"`);

        // Drop indexes
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_live_chat_message_streamId"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_live_chat_message_userId"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_live_chat_message_createdAt"`);

        // Drop table
        await queryRunner.query(`DROP TABLE IF EXISTS "live_chat_message"`);
    }
}
