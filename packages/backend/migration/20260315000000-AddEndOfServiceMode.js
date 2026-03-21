export class AddEndOfServiceMode20260315000000 {
    name = 'AddEndOfServiceMode20260315000000';

    async up(queryRunner) {
        await queryRunner.query(`ALTER TABLE "meta" ADD COLUMN IF NOT EXISTS "endOfServiceMode" boolean NOT NULL DEFAULT false`);
        await queryRunner.query(`ALTER TABLE "meta" ADD COLUMN IF NOT EXISTS "endOfServiceMessage" character varying(1024) DEFAULT NULL`);
    }

    async down(queryRunner) {
        await queryRunner.query(`ALTER TABLE "meta" DROP COLUMN IF EXISTS "endOfServiceMessage"`);
        await queryRunner.query(`ALTER TABLE "meta" DROP COLUMN IF EXISTS "endOfServiceMode"`);
    }
}
