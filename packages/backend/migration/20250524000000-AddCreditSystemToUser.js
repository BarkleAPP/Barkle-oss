export class AddCreditSystemToUser20250524000000 {
    name = 'AddCreditSystemToUser20250524000000'
    
    async up(queryRunner) {
        // Check if user table exists first
        const userTableExists = await queryRunner.hasTable('user');
        if (!userTableExists) {
            return; // Skip if user table doesn't exist
        }
        
        // Check if subscriptionStatus column exists before adding it
        const subscriptionStatusExists = await queryRunner.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.columns 
                WHERE table_name = 'user' 
                AND column_name = 'subscriptionStatus'
            );
        `);
        
        if (!subscriptionStatusExists[0].exists) {
            // First create the enum type if it doesn't exist
            await queryRunner.query(`
                DO $$ BEGIN
                    CREATE TYPE "user_subscriptionstatus_enum" AS ENUM(
                        'FREE',
                        'BARKLE_PLUS',
                        'MINI_PLUS',
                        'BARKLE_PLUS_CREDIT',
                        'MINI_PLUS_CREDIT',
                        'BARKLE_PLUS_PAUSED',
                        'MINI_PLUS_PAUSED'
                    );
                EXCEPTION
                    WHEN duplicate_object THEN null;
                END $$;
            `);
            
            await queryRunner.query(`
                ALTER TABLE "user" ADD COLUMN "subscriptionStatus" "user_subscriptionstatus_enum" NOT NULL DEFAULT 'FREE'
            `);
        }
        
        // Check if barklePlusCredits column exists before adding it
        const barklePlusCreditsExists = await queryRunner.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.columns 
                WHERE table_name = 'user' 
                AND column_name = 'barklePlusCredits'
            );
        `);
        
        if (!barklePlusCreditsExists[0].exists) {
            await queryRunner.query(`
                ALTER TABLE "user" ADD COLUMN "barklePlusCredits" integer NOT NULL DEFAULT 0
            `);
        }
        
        // Check if miniPlusCredits column exists before adding it
        const miniPlusCreditsExists = await queryRunner.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.columns 
                WHERE table_name = 'user' 
                AND column_name = 'miniPlusCredits'
            );
        `);
        
        if (!miniPlusCreditsExists[0].exists) {
            await queryRunner.query(`
                ALTER TABLE "user" ADD COLUMN "miniPlusCredits" integer NOT NULL DEFAULT 0
            `);
        }
        
        // Check if barklePlusCreditsExpiry column exists before adding it
        const barklePlusCreditsExpiryExists = await queryRunner.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.columns 
                WHERE table_name = 'user' 
                AND column_name = 'barklePlusCreditsExpiry'
            );
        `);
        
        if (!barklePlusCreditsExpiryExists[0].exists) {
            await queryRunner.query(`
                ALTER TABLE "user" ADD COLUMN "barklePlusCreditsExpiry" TIMESTAMP WITH TIME ZONE NULL
            `);
        }
        
        // Check if miniPlusCreditsExpiry column exists before adding it
        const miniPlusCreditsExpiryExists = await queryRunner.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.columns 
                WHERE table_name = 'user' 
                AND column_name = 'miniPlusCreditsExpiry'
            );
        `);
        
        if (!miniPlusCreditsExpiryExists[0].exists) {
            await queryRunner.query(`
                ALTER TABLE "user" ADD COLUMN "miniPlusCreditsExpiry" TIMESTAMP WITH TIME ZONE NULL
            `);
        }
        
        // Add column comments
        await queryRunner.query(`COMMENT ON COLUMN "user"."subscriptionStatus" IS 'The current subscription status of the user.'`);
        await queryRunner.query(`COMMENT ON COLUMN "user"."barklePlusCredits" IS 'Number of Barkle+ credits available.'`);
        await queryRunner.query(`COMMENT ON COLUMN "user"."miniPlusCredits" IS 'Number of Mini+ credits available.'`);
        await queryRunner.query(`COMMENT ON COLUMN "user"."barklePlusCreditsExpiry" IS 'Expiration date for Barkle+ credits.'`);
        await queryRunner.query(`COMMENT ON COLUMN "user"."miniPlusCreditsExpiry" IS 'Expiration date for Mini+ credits.'`);
    }

    async down(queryRunner) {
        // Check if user table exists first
        const userTableExists = await queryRunner.hasTable('user');
        if (!userTableExists) {
            return; // Skip if user table doesn't exist
        }
        
        // Try to remove columns but don't fail if they don't exist
        try {
            await queryRunner.query(`ALTER TABLE "user" DROP COLUMN IF EXISTS "miniPlusCreditsExpiry"`);
            await queryRunner.query(`ALTER TABLE "user" DROP COLUMN IF EXISTS "barklePlusCreditsExpiry"`);
            await queryRunner.query(`ALTER TABLE "user" DROP COLUMN IF EXISTS "miniPlusCredits"`);
            await queryRunner.query(`ALTER TABLE "user" DROP COLUMN IF EXISTS "barklePlusCredits"`);
            await queryRunner.query(`ALTER TABLE "user" DROP COLUMN IF EXISTS "subscriptionStatus"`);
            
            // Drop the enum type if no other tables are using it
            await queryRunner.query(`DROP TYPE IF EXISTS "user_subscriptionstatus_enum"`);
        } catch (error) {
            console.log("Error in down migration, some columns may not exist:", error);
        }
    }
}
