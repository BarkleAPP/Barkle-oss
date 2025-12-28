export class CreateBarktresScoreTable20251101000000 {
    name = 'CreateBarktresScoreTable20251101000000'

    async up(queryRunner) {
        await queryRunner.query(`
            CREATE TABLE "barktres_score" (
                "id" character varying(32) NOT NULL,
                "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL,
                "userId" character varying(32) NOT NULL,
                "score" integer NOT NULL,
                "lines" integer NOT NULL,
                "level" integer NOT NULL,
                "duration" integer NOT NULL,
                "sessionToken" character varying(128) NOT NULL,
                CONSTRAINT "PK_barktres_score" PRIMARY KEY ("id")
            )
        `);

        await queryRunner.query(`
            CREATE INDEX "IDX_barktres_score_createdAt" ON "barktres_score" ("createdAt")
        `);

        await queryRunner.query(`
            CREATE INDEX "IDX_barktres_score_userId" ON "barktres_score" ("userId")
        `);

        await queryRunner.query(`
            CREATE INDEX "IDX_barktres_score_score" ON "barktres_score" ("score")
        `);

        await queryRunner.query(`
            ALTER TABLE "barktres_score"
            ADD CONSTRAINT "FK_barktres_score_userId"
            FOREIGN KEY ("userId")
            REFERENCES "user"("id")
            ON DELETE CASCADE
            ON UPDATE NO ACTION
        `);
    }

    async down(queryRunner) {
        await queryRunner.query(`
            ALTER TABLE "barktres_score"
            DROP CONSTRAINT IF EXISTS "FK_barktres_score_userId"
        `);

        await queryRunner.query(`
            DROP INDEX IF EXISTS "IDX_barktres_score_score"
        `);

        await queryRunner.query(`
            DROP INDEX IF EXISTS "IDX_barktres_score_userId"
        `);

        await queryRunner.query(`
            DROP INDEX IF EXISTS "IDX_barktres_score_createdAt"
        `);

        await queryRunner.query(`
            DROP TABLE IF EXISTS "barktres_score"
        `);
    }
}
