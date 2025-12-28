export class CreateGiftedSubscriptionTable20250509100000 {
    name = 'CreateGiftedSubscriptionTable20250509100000'
    
    async up(queryRunner) {
        // Check if the gifted_subscription table already exists
        const tableExists = await queryRunner.hasTable("gifted_subscription");
        
        if (!tableExists) {
            await queryRunner.query(`
                CREATE TABLE "gifted_subscription" (
                    "id" varchar NOT NULL,
                    "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL,
                    "token" varchar(64) NOT NULL,
                    "plan" varchar(10) NOT NULL,
                    "subscriptionType" varchar(10) NOT NULL,
                    "status" varchar(20) NOT NULL DEFAULT 'pending_redemption',
                    "expiresAt" TIMESTAMP WITH TIME ZONE,
                    "purchasedByUserId" varchar,
                    "redeemedByUserId" varchar,
                    "redeemedAt" TIMESTAMP WITH TIME ZONE,
                    "stripeCheckoutSessionId" varchar(255),
                    "message" text,
                    CONSTRAINT "PK_gifted_subscription" PRIMARY KEY ("id")
                )
            `);
            
            await queryRunner.query(`
                CREATE UNIQUE INDEX "IDX_gifted_subscription_token" ON "gifted_subscription" ("token")
            `);
            
            await queryRunner.query(`
                ALTER TABLE "gifted_subscription" ADD CONSTRAINT "FK_gifted_subscription_purchasedByUserId" 
                FOREIGN KEY ("purchasedByUserId") REFERENCES "user"("id") ON DELETE SET NULL
            `);
            
            await queryRunner.query(`
                ALTER TABLE "gifted_subscription" ADD CONSTRAINT "FK_gifted_subscription_redeemedByUserId" 
                FOREIGN KEY ("redeemedByUserId") REFERENCES "user"("id") ON DELETE SET NULL
            `);
        } else {
            console.log("Skipping creation of gifted_subscription table as it already exists");
            
            // Check if message column exists and add it if it doesn't
            const table = await queryRunner.getTable("gifted_subscription");
            const hasMessageColumn = table?.findColumnByName("message");
            
            if (!hasMessageColumn) {
                await queryRunner.query(`ALTER TABLE "gifted_subscription" ADD COLUMN "message" text NULL`);
            }
            
            // Check if expiresAt column exists and add it if it doesn't
            const hasExpiresAtColumn = table?.findColumnByName("expiresAt");
            
            if (!hasExpiresAtColumn) {
                await queryRunner.query(`ALTER TABLE "gifted_subscription" ADD COLUMN "expiresAt" TIMESTAMP WITH TIME ZONE NULL`);
            }
        }
        
        // Add column comments
        await queryRunner.query(`COMMENT ON COLUMN "gifted_subscription"."createdAt" IS 'The created date of the gifted subscription.'`);
        await queryRunner.query(`COMMENT ON COLUMN "gifted_subscription"."token" IS 'Unique token for the gift redemption link.'`);
        await queryRunner.query(`COMMENT ON COLUMN "gifted_subscription"."plan" IS 'The plan type of the gifted subscription (e.g., plus, mplus).'`);
        await queryRunner.query(`COMMENT ON COLUMN "gifted_subscription"."subscriptionType" IS 'The duration of the gifted subscription (e.g., month, year).'`);
        await queryRunner.query(`COMMENT ON COLUMN "gifted_subscription"."status" IS 'The status of the gifted subscription.'`);
        await queryRunner.query(`COMMENT ON COLUMN "gifted_subscription"."expiresAt" IS 'The date when the gift subscription expires if not redeemed.'`);
        await queryRunner.query(`COMMENT ON COLUMN "gifted_subscription"."purchasedByUserId" IS 'The ID of the user who purchased this gift.'`);
        await queryRunner.query(`COMMENT ON COLUMN "gifted_subscription"."redeemedByUserId" IS 'The ID of the user who redeemed this gift.'`);
        await queryRunner.query(`COMMENT ON COLUMN "gifted_subscription"."redeemedAt" IS 'The date when the gifted subscription was redeemed.'`);
        await queryRunner.query(`COMMENT ON COLUMN "gifted_subscription"."stripeCheckoutSessionId" IS 'The Stripe Checkout Session ID associated with the purchase of this gift.'`);
        await queryRunner.query(`COMMENT ON COLUMN "gifted_subscription"."message" IS 'Optional personalized message from the gift purchaser to the recipient.'`);
    }

    async down(queryRunner) {
        // Check if the table exists first
        const tableExists = await queryRunner.hasTable("gifted_subscription");
        
        if (tableExists) {
            const table = await queryRunner.getTable("gifted_subscription");
            
            // Check if constraints exist before trying to drop them
            const redeemedByFk = table.foreignKeys.find(fk => fk.columnNames.indexOf("redeemedByUserId") !== -1);
            if (redeemedByFk) {
                await queryRunner.query(`ALTER TABLE "gifted_subscription" DROP CONSTRAINT "${redeemedByFk.name}"`);
            }
            
            const purchasedByFk = table.foreignKeys.find(fk => fk.columnNames.indexOf("purchasedByUserId") !== -1);
            if (purchasedByFk) {
                await queryRunner.query(`ALTER TABLE "gifted_subscription" DROP CONSTRAINT "${purchasedByFk.name}"`);
            }
            
            // Check if the index exists before trying to drop it
            const tokenIndex = table.indices.find(idx => idx.columnNames.indexOf("token") !== -1);
            if (tokenIndex) {
                await queryRunner.query(`DROP INDEX "${tokenIndex.name}"`);
            }
            
            // If this is the migration that created the table, drop it
            const messageColumn = table.findColumnByName("message");
            if (messageColumn) {
                await queryRunner.query(`DROP TABLE "gifted_subscription"`);
            }
        }
    }
}
