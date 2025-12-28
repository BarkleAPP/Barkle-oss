export class addOauthState1704067200000 {
	async up(queryRunner) {
		await queryRunner.query(`ALTER TABLE "auth_session" ADD "state" character varying(128)`);
	}

	async down(queryRunner) {
		await queryRunner.query(`ALTER TABLE "auth_session" DROP COLUMN "state"`);
	}
}