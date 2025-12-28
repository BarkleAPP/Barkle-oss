export class AddWebhookEventTable1732866000000 {
    name = 'AddWebhookEventTable1732866000000'
    
    async up(queryRunner) {
        // Create webhook_event table for multi-provider webhook idempotency
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "webhook_event" (
                "id" VARCHAR(32) NOT NULL,
                "provider" VARCHAR(64) NOT NULL,
                "eventId" VARCHAR(256) NOT NULL,
                "eventType" VARCHAR(128) NOT NULL,
                "processedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
                "eventData" jsonb NOT NULL DEFAULT '{}',
                "userId" VARCHAR(128),
                
                CONSTRAINT "PK_webhook_event" PRIMARY KEY ("id")
            )
        `);

        // Create index on provider for filtering by webhook source
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_webhook_event_provider" ON "webhook_event" ("provider")`);

        // Create unique composite index on (provider, eventId) for true idempotency
        await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_webhook_event_provider_eventId" ON "webhook_event" ("provider", "eventId")`);

        // Create index on eventType for filtering
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_webhook_event_eventType" ON "webhook_event" ("eventType")`);

        // Create index on processedAt for cleanup queries
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_webhook_event_processedAt" ON "webhook_event" ("processedAt")`);

        // Create partial index on userId (only for non-null values) for user-specific queries
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_webhook_event_userId" ON "webhook_event" ("userId") WHERE "userId" IS NOT NULL`);

        // Add column comments
        await queryRunner.query(`COMMENT ON COLUMN "webhook_event"."id" IS 'Internal event ID'`);
        await queryRunner.query(`COMMENT ON COLUMN "webhook_event"."provider" IS 'Webhook provider (stripe, mux, revenuecat, etc.)'`);
        await queryRunner.query(`COMMENT ON COLUMN "webhook_event"."eventId" IS 'Provider-specific event ID for idempotency'`);
        await queryRunner.query(`COMMENT ON COLUMN "webhook_event"."eventType" IS 'Event type (e.g., payment.succeeded, video.asset.ready)'`);
        await queryRunner.query(`COMMENT ON COLUMN "webhook_event"."processedAt" IS 'When the event was processed'`);
        await queryRunner.query(`COMMENT ON COLUMN "webhook_event"."eventData" IS 'Full event data for debugging'`);
        await queryRunner.query(`COMMENT ON COLUMN "webhook_event"."userId" IS 'User ID associated with this event'`);
    }

    async down(queryRunner) {
        // Drop indexes
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_webhook_event_userId"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_webhook_event_processedAt"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_webhook_event_eventType"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_webhook_event_provider_eventId"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_webhook_event_provider"`);

        // Drop table
        await queryRunner.query(`DROP TABLE IF EXISTS "webhook_event"`);
    }
}
