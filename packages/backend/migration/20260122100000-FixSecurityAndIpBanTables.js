export class FixSecurityAndIpBanTables20260122100000 {
    name = 'FixSecurityAndIpBanTables20260122100000'

    async up(queryRunner) {
        // Check if security_event table exists
        const securityEventTable = await queryRunner.query(`
            SELECT table_name
            FROM information_schema.tables
            WHERE table_name = 'security_event'
        `);

        if (securityEventTable.length === 0) {
            // Create security_event table if it doesn't exist
            await queryRunner.query(`CREATE TABLE "security_event" ("id" character varying(32) NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL, "type" character varying(128) NOT NULL, "userId" character varying(32), "ipAddress" character varying(128), "userAgent" character varying(512), "details" jsonb, "severity" character varying(32), "reviewed" boolean NOT NULL DEFAULT false, CONSTRAINT "PK_security_event" PRIMARY KEY ("id"))`);
            await queryRunner.query(`CREATE INDEX "IDX_security_event_userId" ON "security_event" ("userId")`);
            await queryRunner.query(`CREATE INDEX "IDX_security_event_type" ON "security_event" ("type")`);
            await queryRunner.query(`CREATE INDEX "IDX_security_event_createdAt" ON "security_event" ("createdAt")`);
            await queryRunner.query(`ALTER TABLE "security_event" ADD CONSTRAINT "FK_security_event_userId" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        } else {
            // Table exists - check if type column is enum and needs to be converted to varchar
            const typeColumn = await queryRunner.query(`
                SELECT data_type, udt_name
                FROM information_schema.columns
                WHERE table_name = 'security_event' AND column_name = 'type'
            `);

            if (typeColumn.length > 0 && typeColumn[0].data_type === 'USER-DEFINED') {
                // Convert enum to varchar
                await queryRunner.query(`ALTER TABLE "security_event" ALTER COLUMN "type" TYPE character varying(128) USING "type"::text`);
            }

            // Ensure indexes exist
            const indexes = await queryRunner.query(`
                SELECT indexname FROM pg_indexes WHERE tablename = 'security_event'
            `);
            const indexNames = indexes.map(i => i.indexname);

            if (!indexNames.includes('IDX_security_event_userId')) {
                await queryRunner.query(`CREATE INDEX "IDX_security_event_userId" ON "security_event" ("userId")`);
            }
            if (!indexNames.includes('IDX_security_event_type')) {
                await queryRunner.query(`CREATE INDEX "IDX_security_event_type" ON "security_event" ("type")`);
            }
            if (!indexNames.includes('IDX_security_event_createdAt')) {
                await queryRunner.query(`CREATE INDEX "IDX_security_event_createdAt" ON "security_event" ("createdAt")`);
            }

            // Ensure foreign key exists
            const fk = await queryRunner.query(`
                SELECT constraint_name FROM information_schema.table_constraints
                WHERE table_name = 'security_event' AND constraint_type = 'FOREIGN KEY'
            `);
            if (fk.length === 0) {
                await queryRunner.query(`ALTER TABLE "security_event" ADD CONSTRAINT "FK_security_event_userId" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
            }
        }

        // Check if ip_ban table exists
        const ipBanTable = await queryRunner.query(`
            SELECT table_name
            FROM information_schema.tables
            WHERE table_name = 'ip_ban'
        `);

        if (ipBanTable.length === 0) {
            // Create ip_ban table if it doesn't exist
            await queryRunner.query(`CREATE TABLE "ip_ban" ("id" character varying(32) NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL, "userId" character varying(32), "ip" character varying(128) NOT NULL, "reason" character varying(512), "expiresAt" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_ip_ban" PRIMARY KEY ("id"))`);
            await queryRunner.query(`CREATE UNIQUE INDEX "IDX_ip_ban_ip" ON "ip_ban" ("ip")`);
            await queryRunner.query(`CREATE INDEX "IDX_ip_ban_userId" ON "ip_ban" ("userId")`);
            await queryRunner.query(`CREATE INDEX "IDX_ip_ban_expiresAt" ON "ip_ban" ("expiresAt")`);
            await queryRunner.query(`ALTER TABLE "ip_ban" ADD CONSTRAINT "FK_ip_ban_userId" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        } else {
            // Table exists - ensure indexes exist
            const indexes = await queryRunner.query(`
                SELECT indexname FROM pg_indexes WHERE tablename = 'ip_ban'
            `);
            const indexNames = indexes.map(i => i.indexname);

            if (!indexNames.includes('IDX_ip_ban_ip')) {
                await queryRunner.query(`CREATE UNIQUE INDEX "IDX_ip_ban_ip" ON "ip_ban" ("ip")`);
            }
            if (!indexNames.includes('IDX_ip_ban_userId')) {
                await queryRunner.query(`CREATE INDEX "IDX_ip_ban_userId" ON "ip_ban" ("userId")`);
            }
            if (!indexNames.includes('IDX_ip_ban_expiresAt')) {
                await queryRunner.query(`CREATE INDEX "IDX_ip_ban_expiresAt" ON "ip_ban" ("expiresAt")`);
            }

            // Ensure foreign key exists
            const fk = await queryRunner.query(`
                SELECT constraint_name FROM information_schema.table_constraints
                WHERE table_name = 'ip_ban' AND constraint_type = 'FOREIGN KEY'
            `);
            if (fk.length === 0) {
                await queryRunner.query(`ALTER TABLE "ip_ban" ADD CONSTRAINT "FK_ip_ban_userId" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
            }
        }
    }

    async down(queryRunner) {
        // This migration is a fix migration, down should be a no-op
        // The original tables will remain as-is
    }
}
