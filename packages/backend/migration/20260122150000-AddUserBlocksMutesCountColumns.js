export class AddUserBlocksMutesCountColumns20260122150000 {
    name = 'AddUserBlocksMutesCountColumns20260122150000';

    async up(queryRunner) {
        // Add blocksReceivedCount column if it doesn't exist
        const hasBlocksColumn = await queryRunner.query(`
            SELECT column_name FROM information_schema.columns 
            WHERE table_name = 'user' AND column_name = 'blocksReceivedCount'
        `);
        if (hasBlocksColumn.length === 0) {
            await queryRunner.query(`ALTER TABLE "user" ADD COLUMN "blocksReceivedCount" integer NOT NULL DEFAULT 0`);
            await queryRunner.query(`CREATE INDEX "IDX_user_blocksReceivedCount" ON "user" ("blocksReceivedCount")`);
        }

        // Add mutesReceivedCount column if it doesn't exist
        const hasMutesColumn = await queryRunner.query(`
            SELECT column_name FROM information_schema.columns 
            WHERE table_name = 'user' AND column_name = 'mutesReceivedCount'
        `);
        if (hasMutesColumn.length === 0) {
            await queryRunner.query(`ALTER TABLE "user" ADD COLUMN "mutesReceivedCount" integer NOT NULL DEFAULT 0`);
            await queryRunner.query(`CREATE INDEX "IDX_user_mutesReceivedCount" ON "user" ("mutesReceivedCount")`);
        }

        // Add reputationScore column if it doesn't exist
        const hasReputationColumn = await queryRunner.query(`
            SELECT column_name FROM information_schema.columns 
            WHERE table_name = 'user' AND column_name = 'reputationScore'
        `);
        if (hasReputationColumn.length === 0) {
            await queryRunner.query(`ALTER TABLE "user" ADD COLUMN "reputationScore" double precision DEFAULT 0.5`);
            await queryRunner.query(`CREATE INDEX "IDX_user_reputationScore" ON "user" ("reputationScore")`);
        }
    }

    async down(queryRunner) {
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_user_reputationScore"`);
        await queryRunner.query(`ALTER TABLE "user" DROP COLUMN IF EXISTS "reputationScore"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_user_mutesReceivedCount"`);
        await queryRunner.query(`ALTER TABLE "user" DROP COLUMN IF EXISTS "mutesReceivedCount"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_user_blocksReceivedCount"`);
        await queryRunner.query(`ALTER TABLE "user" DROP COLUMN IF EXISTS "blocksReceivedCount"`);
    }
}
