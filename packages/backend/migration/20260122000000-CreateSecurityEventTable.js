
export class CreateSecurityEventTable20260122000000 {
    async up(queryRunner) {
        await queryRunner.query(`CREATE TABLE "security_event" ("id" character varying(32) NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL, "type" character varying(128) NOT NULL, "userId" character varying(32), "ipAddress" character varying(128), "userAgent" character varying(512), "details" jsonb, "severity" character varying(32), "reviewed" boolean NOT NULL DEFAULT false, CONSTRAINT "PK_security_event" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_security_event_userId" ON "security_event" ("userId")`);
        await queryRunner.query(`CREATE INDEX "IDX_security_event_type" ON "security_event" ("type")`);
        await queryRunner.query(`CREATE INDEX "IDX_security_event_createdAt" ON "security_event" ("createdAt")`);
        await queryRunner.query(`ALTER TABLE "security_event" ADD CONSTRAINT "FK_security_event_userId" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    async down(queryRunner) {
        await queryRunner.query(`ALTER TABLE "security_event" DROP CONSTRAINT "FK_security_event_userId"`);
        await queryRunner.query(`DROP INDEX "IDX_security_event_createdAt"`);
        await queryRunner.query(`DROP INDEX "IDX_security_event_type"`);
        await queryRunner.query(`DROP INDEX "IDX_security_event_userId"`);
        await queryRunner.query(`DROP TABLE "security_event"`);
    }
}
