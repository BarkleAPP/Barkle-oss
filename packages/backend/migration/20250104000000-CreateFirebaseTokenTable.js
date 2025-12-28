export class CreateFirebaseTokenTable20250104000000 {
    name = 'CreateFirebaseTokenTable20250104000000'
    
    async up(queryRunner) {
        // Create firebase_tokens table for FCM token storage
        await queryRunner.query(`
            CREATE TABLE "firebase_token" (
                "id" VARCHAR(32) NOT NULL,
                "userId" VARCHAR(32) NOT NULL,
                "token" TEXT NOT NULL,
                "deviceId" VARCHAR(255),
                "platform" VARCHAR(50) NOT NULL DEFAULT 'web',
                "appVersion" VARCHAR(50),
                "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
                "lastUsed" TIMESTAMP WITH TIME ZONE,
                "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
                "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
                
                CONSTRAINT "PK_firebase_token" PRIMARY KEY ("id"),
                CONSTRAINT "FK_firebase_token_user" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE
            )
        `);
        
        // Create notification_schedule table for random engagement notifications
        await queryRunner.query(`
            CREATE TABLE "notification_schedule" (
                "id" VARCHAR(32) NOT NULL,
                "userId" VARCHAR(32) NOT NULL,
                "type" VARCHAR(50) NOT NULL,
                "scheduledAt" TIMESTAMP WITH TIME ZONE NOT NULL,
                "sentAt" TIMESTAMP WITH TIME ZONE,
                "data" JSONB,
                "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
                "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
                
                CONSTRAINT "PK_notification_schedule" PRIMARY KEY ("id"),
                CONSTRAINT "FK_notification_schedule_user" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE
            )
        `);
        
        // Create indexes for performance
        await queryRunner.query(`CREATE INDEX "IDX_firebase_token_userId" ON "firebase_token" ("userId")`);
        await queryRunner.query(`CREATE INDEX "IDX_firebase_token_token" ON "firebase_token" ("token")`);
        await queryRunner.query(`CREATE INDEX "IDX_firebase_token_active" ON "firebase_token" ("isActive")`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_firebase_token_user_device" ON "firebase_token" ("userId", "deviceId", "platform") WHERE "deviceId" IS NOT NULL`);
        
        await queryRunner.query(`CREATE INDEX "IDX_notification_schedule_userId" ON "notification_schedule" ("userId")`);
        await queryRunner.query(`CREATE INDEX "IDX_notification_schedule_scheduled" ON "notification_schedule" ("scheduledAt")`);
        await queryRunner.query(`CREATE INDEX "IDX_notification_schedule_active" ON "notification_schedule" ("isActive")`);
        await queryRunner.query(`CREATE INDEX "IDX_notification_schedule_type" ON "notification_schedule" ("type")`);
        
        // Add column comments
        await queryRunner.query(`COMMENT ON COLUMN "firebase_token"."id" IS 'The unique identifier for the Firebase token record.'`);
        await queryRunner.query(`COMMENT ON COLUMN "firebase_token"."userId" IS 'The ID of the user who owns this token.'`);
        await queryRunner.query(`COMMENT ON COLUMN "firebase_token"."token" IS 'The Firebase Cloud Messaging token.'`);
        await queryRunner.query(`COMMENT ON COLUMN "firebase_token"."deviceId" IS 'Unique device identifier for deduplication.'`);
        await queryRunner.query(`COMMENT ON COLUMN "firebase_token"."platform" IS 'Platform: web, ios, android.'`);
        await queryRunner.query(`COMMENT ON COLUMN "firebase_token"."isActive" IS 'Whether this token is still valid and active.'`);
        
        await queryRunner.query(`COMMENT ON COLUMN "notification_schedule"."id" IS 'The unique identifier for the scheduled notification.'`);
        await queryRunner.query(`COMMENT ON COLUMN "notification_schedule"."userId" IS 'The ID of the user to notify.'`);
        await queryRunner.query(`COMMENT ON COLUMN "notification_schedule"."type" IS 'Type of notification: comeback, engagement, social_proof, etc.'`);
        await queryRunner.query(`COMMENT ON COLUMN "notification_schedule"."scheduledAt" IS 'When this notification should be sent.'`);
        await queryRunner.query(`COMMENT ON COLUMN "notification_schedule"."data" IS 'JSON data for the notification content.'`);
    }

    async down(queryRunner) {
        await queryRunner.query(`DROP TABLE IF EXISTS "notification_schedule"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "firebase_token"`);
    }
}