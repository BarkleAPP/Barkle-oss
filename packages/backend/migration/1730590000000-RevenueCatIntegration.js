/**
 * Migration: RevenueCat Integration - Simplify Mobile Billing
 * 
 * Replaces Google Play and App Store direct integrations with unified RevenueCat platform
 */
export class RevenueCatIntegration1730590000000 {
    name = 'RevenueCatIntegration1730590000000'

    async up(queryRunner) {
        // 1. Create new enum type for subscription platforms (simplified)
        await queryRunner.query(`
            CREATE TYPE "user_subscriptionplatform_enum_new" AS ENUM('stripe', 'revenuecat', 'credit')
        `);

        // 2. Migrate existing mobile subscribers to 'revenuecat' platform
        // Note: If you have existing google_play or app_store users, they'll need manual migration
        await queryRunner.query(`
            ALTER TABLE "user"
            ADD COLUMN "subscriptionPlatform_new" "user_subscriptionplatform_enum_new"
        `);

        // Only update if the old column exists
        const hasOldColumn = await queryRunner.query(`
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'user' AND column_name = 'subscriptionPlatform'
        `);

        if (hasOldColumn.length > 0) {
            await queryRunner.query(`
                UPDATE "user"
                SET "subscriptionPlatform_new" = 
                    (CASE 
                        WHEN "subscriptionPlatform"::text = 'stripe' THEN 'stripe'
                        WHEN "subscriptionPlatform"::text = 'credit' THEN 'credit'
                        WHEN "subscriptionPlatform"::text IN ('google_play', 'app_store') THEN 'revenuecat'
                        ELSE NULL
                    END)::"user_subscriptionplatform_enum_new"
                WHERE "subscriptionPlatform" IS NOT NULL
            `);
        }

        // Set default platform for users without any platform set
        await queryRunner.query(`
            UPDATE "user"
            SET "subscriptionPlatform_new" = 'credit'
            WHERE "subscriptionPlatform_new" IS NULL
            AND ("barklePlusCredits" > 0 OR "miniPlusCredits" > 0)
        `);

        // 3. Drop old column and enum (if they exist)
        const hasOldColumnForDrop = await queryRunner.query(`
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'user' AND column_name = 'subscriptionPlatform'
        `);

        if (hasOldColumnForDrop.length > 0) {
            await queryRunner.query(`
                ALTER TABLE "user" DROP COLUMN "subscriptionPlatform"
            `);
        }

        await queryRunner.query(`
            DROP TYPE IF EXISTS "user_subscriptionplatform_enum"
        `);

        // 4. Rename new column to correct name
        await queryRunner.query(`
            ALTER TABLE "user" RENAME COLUMN "subscriptionPlatform_new" TO "subscriptionPlatform"
        `);

        // 5. Rename enum type
        await queryRunner.query(`
            ALTER TYPE "user_subscriptionplatform_enum_new" RENAME TO "user_subscriptionplatform_enum"
        `);

        // 6. Rename mobileSubscriptionId to revenueCatUserId (if it exists)
        const hasMobileSubscriptionId = await queryRunner.query(`
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'user' AND column_name = 'mobileSubscriptionId'
        `);

        if (hasMobileSubscriptionId.length > 0) {
            await queryRunner.query(`
                ALTER TABLE "user" RENAME COLUMN "mobileSubscriptionId" TO "revenueCatUserId"
            `);
        } else {
            // Add the column if it doesn't exist
            await queryRunner.query(`
                ALTER TABLE "user" ADD COLUMN "revenueCatUserId" varchar(512)
            `);
        }

        // 7. Update column comment
        await queryRunner.query(`
            COMMENT ON COLUMN "user"."revenueCatUserId" IS 'RevenueCat App User ID for mobile subscription tracking.'
        `);

        console.log('✅ Migrated subscription platform to RevenueCat');
        console.log('✅ Existing mobile users (google_play/app_store) mapped to revenuecat');
    }

    async down(queryRunner) {
        // Rollback changes

        // 1. Rename back to mobileSubscriptionId (if revenueCatUserId exists)
        const hasRevenueCatUserId = await queryRunner.query(`
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'user' AND column_name = 'revenueCatUserId'
        `);

        if (hasRevenueCatUserId.length > 0) {
            await queryRunner.query(`
                ALTER TABLE "user" RENAME COLUMN "revenueCatUserId" TO "mobileSubscriptionId"
            `);
        }

        // 2. Create old enum type
        await queryRunner.query(`
            CREATE TYPE "user_subscriptionplatform_enum_old" AS ENUM('stripe', 'google_play', 'app_store', 'credit')
        `);

        // 3. Add temporary column with old enum
        await queryRunner.query(`
            ALTER TABLE "user"
            ADD COLUMN "subscriptionPlatform_old" "user_subscriptionplatform_enum_old"
        `);

        // 4. Migrate data back (revenuecat -> google_play as default)
        await queryRunner.query(`
            UPDATE "user"
            SET "subscriptionPlatform_old" = 
                (CASE 
                    WHEN "subscriptionPlatform"::text = 'stripe' THEN 'stripe'
                    WHEN "subscriptionPlatform"::text = 'credit' THEN 'credit'
                    WHEN "subscriptionPlatform"::text = 'revenuecat' THEN 'google_play'
                    ELSE NULL
                END)::"user_subscriptionplatform_enum_old"
        `);

        // 5. Drop new column and enum
        await queryRunner.query(`
            ALTER TABLE "user" DROP COLUMN "subscriptionPlatform"
        `);

        await queryRunner.query(`
            DROP TYPE "user_subscriptionplatform_enum"
        `);

        // 6. Rename old column back
        await queryRunner.query(`
            ALTER TABLE "user" RENAME COLUMN "subscriptionPlatform_old" TO "subscriptionPlatform"
        `);

        // 7. Rename enum type back
        await queryRunner.query(`
            ALTER TYPE "user_subscriptionplatform_enum_old" RENAME TO "user_subscriptionplatform_enum"
        `);

        console.log('⏪ Rolled back to Google Play/App Store direct integration');
    }
}
