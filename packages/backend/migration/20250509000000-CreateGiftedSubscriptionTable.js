export class CreateGiftedSubscriptionTable20250509000000 {
    name = 'CreateGiftedSubscriptionTable20250509000000'

    async up(queryRunner) {
        // Create the gifted_subscription table
        await queryRunner.query(`
            CREATE TABLE "gifted_subscription" (
                "id" varchar(32) PRIMARY KEY,
                "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL,
                "token" varchar(64) NOT NULL UNIQUE,
                "plan" varchar(10) NOT NULL,
                "subscriptionType" varchar(10) NOT NULL,
                "status" varchar(20) NOT NULL DEFAULT 'pending_redemption',
                "purchasedByUserId" varchar(32) NULL,
                "redeemedByUserId" varchar(32) NULL,
                "redeemedAt" TIMESTAMP WITH TIME ZONE NULL,
                "stripeCheckoutSessionId" varchar(255) NULL
            )
        `);
    }

    async down(queryRunner) {
        // Drop table if it exists
        const tableExists = await queryRunner.hasTable("gifted_subscription");
        if (tableExists) {
            await queryRunner.query(`DROP TABLE "gifted_subscription"`);
        }
    }
}
