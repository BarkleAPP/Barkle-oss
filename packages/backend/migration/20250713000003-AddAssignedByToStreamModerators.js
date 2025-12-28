export class AddAssignedByToStreamModerators1673515200003 {
	async up(queryRunner) {
		await queryRunner.query(`
			ALTER TABLE "stream_moderators" 
			ADD COLUMN "assignedBy" character varying(32) NOT NULL DEFAULT ''
		`);

		await queryRunner.query(`
			ALTER TABLE "stream_moderators" 
			ADD CONSTRAINT "FK_stream_moderators_assignedBy" 
			FOREIGN KEY ("assignedBy") REFERENCES "user"("id") ON DELETE CASCADE
		`);

		await queryRunner.query(`
			CREATE INDEX "IDX_stream_moderators_assignedBy" 
			ON "stream_moderators" ("assignedBy")
		`);
	}

	async down(queryRunner) {
		await queryRunner.query(`DROP INDEX "IDX_stream_moderators_assignedBy"`);
		await queryRunner.query(`ALTER TABLE "stream_moderators" DROP CONSTRAINT "FK_stream_moderators_assignedBy"`);
		await queryRunner.query(`ALTER TABLE "stream_moderators" DROP COLUMN "assignedBy"`);
	}
}
