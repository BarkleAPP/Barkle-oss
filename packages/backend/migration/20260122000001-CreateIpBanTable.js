
export class CreateIpBanTable20260122000001 {
    async up(queryRunner) {
        await queryRunner.query(`CREATE TABLE "ip_ban" ("id" character varying(32) NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL, "userId" character varying(32), "ip" character varying(128) NOT NULL, "reason" character varying(512), "expiresAt" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_ip_ban" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_ip_ban_ip" ON "ip_ban" ("ip")`);
        await queryRunner.query(`CREATE INDEX "IDX_ip_ban_userId" ON "ip_ban" ("userId")`);
        await queryRunner.query(`CREATE INDEX "IDX_ip_ban_expiresAt" ON "ip_ban" ("expiresAt")`);
        await queryRunner.query(`ALTER TABLE "ip_ban" ADD CONSTRAINT "FK_ip_ban_userId" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    async down(queryRunner) {
        await queryRunner.query(`ALTER TABLE "ip_ban" DROP CONSTRAINT "FK_ip_ban_userId"`);
        await queryRunner.query(`DROP INDEX "IDX_ip_ban_expiresAt"`);
        await queryRunner.query(`DROP INDEX "IDX_ip_ban_userId"`);
        await queryRunner.query(`DROP INDEX "IDX_ip_ban_ip"`);
        await queryRunner.query(`DROP TABLE "ip_ban"`);
    }
}
