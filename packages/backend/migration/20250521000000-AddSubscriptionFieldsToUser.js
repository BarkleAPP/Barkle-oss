export class AddSubscriptionFieldsToUser20250521000000 {
    name = 'AddSubscriptionFieldsToUser20250521000000'
    
    async up(queryRunner) {
        // Check if user table exists first
        const userTableExists = await queryRunner.hasTable('user');
        if (!userTableExists) {
            return; // Skip if user table doesn't exist
        }
        
        // Check if subscriptionEndDate column exists before adding it
        const subscriptionEndDateExists = await queryRunner.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.columns 
                WHERE table_name = 'user' 
                AND column_name = 'subscriptionEndDate'
            );
        `);
        
        if (!subscriptionEndDateExists[0].exists) {
            await queryRunner.query(`
                ALTER TABLE "user" ADD COLUMN "subscriptionEndDate" TIMESTAMP WITH TIME ZONE NULL
            `);
        }
        
        // Check if pausedSubscriptionId column exists before adding it
        const pausedSubscriptionIdExists = await queryRunner.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.columns 
                WHERE table_name = 'user' 
                AND column_name = 'pausedSubscriptionId'
            );
        `);
        
        if (!pausedSubscriptionIdExists[0].exists) {
            await queryRunner.query(`
                ALTER TABLE "user" ADD COLUMN "pausedSubscriptionId" varchar NULL
            `);
        }
        
        // Check if giftCreditPlan column exists before adding it
        const giftCreditPlanExists = await queryRunner.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.columns 
                WHERE table_name = 'user' 
                AND column_name = 'giftCreditPlan'
            );
        `);
        
        if (!giftCreditPlanExists[0].exists) {
            await queryRunner.query(`
                ALTER TABLE "user" ADD COLUMN "giftCreditPlan" varchar(10) NULL
            `);
        }
        
        // Check if giftCreditEndDate column exists before adding it
        const giftCreditEndDateExists = await queryRunner.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.columns 
                WHERE table_name = 'user' 
                AND column_name = 'giftCreditEndDate'
            );
        `);
        
        if (!giftCreditEndDateExists[0].exists) {
            await queryRunner.query(`
                ALTER TABLE "user" ADD COLUMN "giftCreditEndDate" TIMESTAMP WITH TIME ZONE NULL
            `);
        }
        
        // Check if previousSubscriptionPlan column exists before adding it
        const previousSubscriptionPlanExists = await queryRunner.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.columns 
                WHERE table_name = 'user' 
                AND column_name = 'previousSubscriptionPlan'
            );
        `);
        
        if (!previousSubscriptionPlanExists[0].exists) {
            await queryRunner.query(`
                ALTER TABLE "user" ADD COLUMN "previousSubscriptionPlan" varchar(10) NULL
            `);
        }
        
        // Add column comments only if columns were actually added
        // These should not error even if the column already existed
        await queryRunner.query(`COMMENT ON COLUMN "user"."subscriptionEndDate" IS 'The date when the user subscription ends.'`);
        await queryRunner.query(`COMMENT ON COLUMN "user"."pausedSubscriptionId" IS 'The ID of the paused subscription when a gift is active.'`);
        await queryRunner.query(`COMMENT ON COLUMN "user"."giftCreditPlan" IS 'The plan type of a stored gift credit.'`);
        await queryRunner.query(`COMMENT ON COLUMN "user"."giftCreditEndDate" IS 'The end date of a stored gift credit.'`);
        await queryRunner.query(`COMMENT ON COLUMN "user"."previousSubscriptionPlan" IS 'The previous subscription plan to revert to after a gift ends.'`);
    }

    async down(queryRunner) {
        // Check if user table exists first
        const userTableExists = await queryRunner.hasTable('user');
        if (!userTableExists) {
            return; // Skip if user table doesn't exist
        }
        
        // Try to remove columns but don't fail if they don't exist
        try {
            await queryRunner.query(`ALTER TABLE "user" DROP COLUMN IF EXISTS "previousSubscriptionPlan"`);
            await queryRunner.query(`ALTER TABLE "user" DROP COLUMN IF EXISTS "giftCreditEndDate"`);
            await queryRunner.query(`ALTER TABLE "user" DROP COLUMN IF EXISTS "giftCreditPlan"`);
            await queryRunner.query(`ALTER TABLE "user" DROP COLUMN IF EXISTS "pausedSubscriptionId"`);
            await queryRunner.query(`ALTER TABLE "user" DROP COLUMN IF EXISTS "subscriptionEndDate"`);
        } catch (error) {
            console.log("Error in down migration, some columns may not exist:", error);
        }
    }
}
