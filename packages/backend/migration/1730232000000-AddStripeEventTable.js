export class AddStripeEventTable1730232000000 {
    name = 'AddStripeEventTable1730232000000'
    
    async up(queryRunner) {
        // Create stripe_event table for webhook idempotency
        await queryRunner.query(`
            CREATE TABLE "stripe_event" (
                "id" VARCHAR(255) NOT NULL,
                "type" VARCHAR(128) NOT NULL,
                "processedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
                "eventData" jsonb NOT NULL DEFAULT '{}',
                "userId" VARCHAR(32),
                
                CONSTRAINT "PK_stripe_event" PRIMARY KEY ("id")
            )
        `);

        // Create index on type for faster lookups
        await queryRunner.query(`CREATE INDEX "IDX_stripe_event_type" ON "stripe_event" ("type")`);

        // Create index on processedAt for cleanup queries
        await queryRunner.query(`CREATE INDEX "IDX_stripe_event_processedAt" ON "stripe_event" ("processedAt")`);

        // Create index on userId for user-specific queries
        await queryRunner.query(`CREATE INDEX "IDX_stripe_event_userId" ON "stripe_event" ("userId")`);

        // Add column comments
        await queryRunner.query(`COMMENT ON COLUMN "stripe_event"."id" IS 'Stripe event ID from webhook for idempotency'`);
        await queryRunner.query(`COMMENT ON COLUMN "stripe_event"."type" IS 'Stripe event type (e.g., customer.subscription.created)'`);
        await queryRunner.query(`COMMENT ON COLUMN "stripe_event"."processedAt" IS 'When the event was processed by Barkle'`);
        await queryRunner.query(`COMMENT ON COLUMN "stripe_event"."eventData" IS 'Full Stripe event data for debugging and audit'`);
        await queryRunner.query(`COMMENT ON COLUMN "stripe_event"."userId" IS 'User ID associated with this event if available'`);

        // Note: pausedSubscriptionId already exists in user table from 20250521000000-AddSubscriptionFieldsToUser.js
        // No need to add it again
    }

    async down(queryRunner) {
        // Drop indexes
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_stripe_event_userId"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_stripe_event_processedAt"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_stripe_event_type"`);

        // Drop table
        await queryRunner.query(`DROP TABLE IF EXISTS "stripe_event"`);
    }
}
