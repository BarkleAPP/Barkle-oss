/**
 * Migration: RevenueCat Meta Configuration
 * 
 * Removes Google Play and App Store configuration fields
 * Adds RevenueCat configuration fields
 */
export class RevenueCatMetaConfiguration1730590100000 {
    name = 'RevenueCatMetaConfiguration1730590100000'

    async up(queryRunner) {
        // Add RevenueCat configuration fields
        await queryRunner.query(`
            ALTER TABLE "meta"
            ADD COLUMN "enableRevenueCat" boolean NOT NULL DEFAULT false
        `);

        await queryRunner.query(`
            ALTER TABLE "meta"
            ADD COLUMN "revenueCatPublicKey" varchar(256)
        `);

        await queryRunner.query(`
            ALTER TABLE "meta"
            ADD COLUMN "revenueCatSecretKey" varchar(256)
        `);

        await queryRunner.query(`
            ALTER TABLE "meta"
            ADD COLUMN "revenueCatWebhookSecret" varchar(512)
        `);

        // Add comments
        await queryRunner.query(`
            COMMENT ON COLUMN "meta"."enableRevenueCat" IS 'Enable RevenueCat for mobile subscriptions (iOS & Android)'
        `);

        await queryRunner.query(`
            COMMENT ON COLUMN "meta"."revenueCatPublicKey" IS 'RevenueCat Public API Key (for mobile SDK)'
        `);

        await queryRunner.query(`
            COMMENT ON COLUMN "meta"."revenueCatSecretKey" IS 'RevenueCat Secret API Key (for backend API calls)'
        `);

        await queryRunner.query(`
            COMMENT ON COLUMN "meta"."revenueCatWebhookSecret" IS 'RevenueCat Webhook Authorization Secret'
        `);

        // Drop old Google Play fields
        await queryRunner.query(`ALTER TABLE "meta" DROP COLUMN IF EXISTS "enableGooglePlayBilling"`);
        await queryRunner.query(`ALTER TABLE "meta" DROP COLUMN IF EXISTS "googlePlayPackageName"`);
        await queryRunner.query(`ALTER TABLE "meta" DROP COLUMN IF EXISTS "googlePlayServiceAccountJson"`);
        await queryRunner.query(`ALTER TABLE "meta" DROP COLUMN IF EXISTS "googlePlayProductIdMonthPlus"`);
        await queryRunner.query(`ALTER TABLE "meta" DROP COLUMN IF EXISTS "googlePlayProductIdYearPlus"`);
        await queryRunner.query(`ALTER TABLE "meta" DROP COLUMN IF EXISTS "googlePlayProductIdMonthMplus"`);
        await queryRunner.query(`ALTER TABLE "meta" DROP COLUMN IF EXISTS "googlePlayProductIdYearMplus"`);

        // Drop old App Store fields
        await queryRunner.query(`ALTER TABLE "meta" DROP COLUMN IF EXISTS "enableAppStoreBilling"`);
        await queryRunner.query(`ALTER TABLE "meta" DROP COLUMN IF EXISTS "appStoreBundleId"`);
        await queryRunner.query(`ALTER TABLE "meta" DROP COLUMN IF EXISTS "appStoreSharedSecret"`);
        await queryRunner.query(`ALTER TABLE "meta" DROP COLUMN IF EXISTS "appStoreProductIdMonthPlus"`);
        await queryRunner.query(`ALTER TABLE "meta" DROP COLUMN IF EXISTS "appStoreProductIdYearPlus"`);
        await queryRunner.query(`ALTER TABLE "meta" DROP COLUMN IF EXISTS "appStoreProductIdMonthMplus"`);
        await queryRunner.query(`ALTER TABLE "meta" DROP COLUMN IF EXISTS "appStoreProductIdYearMplus"`);
        await queryRunner.query(`ALTER TABLE "meta" DROP COLUMN IF EXISTS "appStoreSandboxMode"`);

        console.log('✅ Added RevenueCat configuration fields');
        console.log('✅ Removed Google Play and App Store configuration fields');
    }

    async down(queryRunner) {
        // Restore Google Play fields
        await queryRunner.query(`ALTER TABLE "meta" ADD COLUMN "enableGooglePlayBilling" boolean NOT NULL DEFAULT false`);
        await queryRunner.query(`ALTER TABLE "meta" ADD COLUMN "googlePlayPackageName" varchar(256)`);
        await queryRunner.query(`ALTER TABLE "meta" ADD COLUMN "googlePlayServiceAccountJson" text`);
        await queryRunner.query(`ALTER TABLE "meta" ADD COLUMN "googlePlayProductIdMonthPlus" varchar(128)`);
        await queryRunner.query(`ALTER TABLE "meta" ADD COLUMN "googlePlayProductIdYearPlus" varchar(128)`);
        await queryRunner.query(`ALTER TABLE "meta" ADD COLUMN "googlePlayProductIdMonthMplus" varchar(128)`);
        await queryRunner.query(`ALTER TABLE "meta" ADD COLUMN "googlePlayProductIdYearMplus" varchar(128)`);

        // Restore App Store fields
        await queryRunner.query(`ALTER TABLE "meta" ADD COLUMN "enableAppStoreBilling" boolean NOT NULL DEFAULT false`);
        await queryRunner.query(`ALTER TABLE "meta" ADD COLUMN "appStoreBundleId" varchar(256)`);
        await queryRunner.query(`ALTER TABLE "meta" ADD COLUMN "appStoreSharedSecret" varchar(512)`);
        await queryRunner.query(`ALTER TABLE "meta" ADD COLUMN "appStoreProductIdMonthPlus" varchar(128)`);
        await queryRunner.query(`ALTER TABLE "meta" ADD COLUMN "appStoreProductIdYearPlus" varchar(128)`);
        await queryRunner.query(`ALTER TABLE "meta" ADD COLUMN "appStoreProductIdMonthMplus" varchar(128)`);
        await queryRunner.query(`ALTER TABLE "meta" ADD COLUMN "appStoreProductIdYearMplus" varchar(128)`);
        await queryRunner.query(`ALTER TABLE "meta" ADD COLUMN "appStoreSandboxMode" boolean NOT NULL DEFAULT false`);

        // Drop RevenueCat fields
        await queryRunner.query(`ALTER TABLE "meta" DROP COLUMN "enableRevenueCat"`);
        await queryRunner.query(`ALTER TABLE "meta" DROP COLUMN "revenueCatPublicKey"`);
        await queryRunner.query(`ALTER TABLE "meta" DROP COLUMN "revenueCatSecretKey"`);
        await queryRunner.query(`ALTER TABLE "meta" DROP COLUMN "revenueCatWebhookSecret"`);

        console.log('⏪ Restored Google Play and App Store configuration fields');
        console.log('⏪ Removed RevenueCat configuration fields');
    }
}
