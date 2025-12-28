export class AddLastfmUsernameToUserProfile1680000000001 {
    name = 'AddLastfmUsernameToUserProfile1680000000001'

    async up(queryRunner) {
        await queryRunner.query(`ALTER TABLE "user_profile" ADD "lastfmUsername" character varying(128)`);
    }

    async down(queryRunner) {
        await queryRunner.query(`ALTER TABLE "user_profile" DROP COLUMN "lastfmUsername"`);
    }
}
