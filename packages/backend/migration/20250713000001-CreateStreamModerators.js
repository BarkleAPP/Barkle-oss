export class CreateStreamModerators1673515200002 {
	async up(queryRunner) {
		await queryRunner.query(`
			CREATE TABLE "stream_moderators" (
				"id" character varying(32) NOT NULL,
				"createdAt" TIMESTAMP WITH TIME ZONE NOT NULL,
				"streamId" character varying(128) NOT NULL,
				"userId" character varying(32) NOT NULL,
				CONSTRAINT "PK_stream_moderators_id" PRIMARY KEY ("id")
			)
		`);

		// Add foreign key constraints
		await queryRunner.query(`
			ALTER TABLE "stream_moderators"
			ADD CONSTRAINT "FK_stream_moderators_streamId"
			FOREIGN KEY ("streamId") REFERENCES "streams"("id") ON DELETE CASCADE
		`);

		await queryRunner.query(`
			ALTER TABLE "stream_moderators"
			ADD CONSTRAINT "FK_stream_moderators_userId"
			FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE
		`);

		// Add unique constraint to prevent duplicate moderators
		await queryRunner.query(`
			CREATE UNIQUE INDEX "IDX_stream_moderators_streamId_userId"
			ON "stream_moderators" ("streamId", "userId")
		`);
	}

	async down(queryRunner) {
		await queryRunner.query(`DROP TABLE "stream_moderators"`);
	}
}
