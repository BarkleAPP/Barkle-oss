export class CreateUserMusicIntegration1680000000000 {
    name = 'CreateUserMusicIntegration1680000000000'

    async up(queryRunner) {
        await queryRunner.query(`
            CREATE TABLE "user_music_integration" (
                "id" character varying(32) NOT NULL,
                "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                "userId" character varying(32) NOT NULL,
                "service" character varying(32) NOT NULL,
                "externalUserId" character varying(256) NOT NULL,
                "username" character varying(256) NOT NULL,
                "accessToken" text,
                "refreshToken" text,
                "expiresAt" TIMESTAMP WITH TIME ZONE,
                CONSTRAINT "PK_user_music_integration_id" PRIMARY KEY ("id"),
                CONSTRAINT "FK_user_music_integration_userId" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE
            )
        `);
        await queryRunner.query(`CREATE INDEX "IDX_user_music_integration_userId" ON "user_music_integration" ("userId")`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_user_music_integration_user_service" ON "user_music_integration" ("userId", "service")`);
    }

    async down(queryRunner) {
        await queryRunner.query(`DROP TABLE "user_music_integration"`);
    }
}
