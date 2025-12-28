export class AddMissingColumns20250710210000 {
    name = 'AddMissingColumns20250710210000'

    async up(queryRunner) {
        // Add missing columns to meta table
        const metaTableExists = await queryRunner.hasTable('meta');
        if (metaTableExists) {
            // Check and add preReleaseMode column
            const preReleaseModeExists = await queryRunner.query(`
                SELECT EXISTS (
                    SELECT FROM information_schema.columns 
                    WHERE table_name = 'meta' 
                    AND column_name = 'preReleaseMode'
                );
            `);
            
            if (!preReleaseModeExists[0].exists) {
                await queryRunner.query(`
                    ALTER TABLE "meta" ADD COLUMN "preReleaseMode" boolean NOT NULL DEFAULT false
                `);
            }

            // Check and add preReleaseAllowedRoles column
            const preReleaseAllowedRolesExists = await queryRunner.query(`
                SELECT EXISTS (
                    SELECT FROM information_schema.columns 
                    WHERE table_name = 'meta' 
                    AND column_name = 'preReleaseAllowedRoles'
                );
            `);
            
            if (!preReleaseAllowedRolesExists[0].exists) {
                await queryRunner.query(`
                    ALTER TABLE "meta" ADD COLUMN "preReleaseAllowedRoles" varchar(256)[] NOT NULL DEFAULT '{staff,admin,moderator,verified}'
                `);
            }

            // Check and add preReleaseAllowedUserIds column
            const preReleaseAllowedUserIdsExists = await queryRunner.query(`
                SELECT EXISTS (
                    SELECT FROM information_schema.columns 
                    WHERE table_name = 'meta' 
                    AND column_name = 'preReleaseAllowedUserIds'
                );
            `);
            
            if (!preReleaseAllowedUserIdsExists[0].exists) {
                await queryRunner.query(`
                    ALTER TABLE "meta" ADD COLUMN "preReleaseAllowedUserIds" varchar(32)[] NOT NULL DEFAULT '{}'
                `);
            }

            // Add gift price ID columns
            const giftPriceColumns = [
                'price_id_gift_month_plus',
                'price_id_gift_year_plus',
                'price_id_gift_month_mplus',
                'price_id_gift_year_mplus'
            ];

            for (const columnName of giftPriceColumns) {
                const columnExists = await queryRunner.query(`
                    SELECT EXISTS (
                        SELECT FROM information_schema.columns 
                        WHERE table_name = 'meta' 
                        AND column_name = '${columnName}'
                    );
                `);
                
                if (!columnExists[0].exists) {
                    await queryRunner.query(`
                        ALTER TABLE "meta" ADD COLUMN "${columnName}" varchar(128) NULL
                    `);
                }
            }
        }

        // Add missing columns to user table
        const userTableExists = await queryRunner.hasTable('user');
        if (userTableExists) {
            // Check and add isVerified column
            const isVerifiedExists = await queryRunner.query(`
                SELECT EXISTS (
                    SELECT FROM information_schema.columns 
                    WHERE table_name = 'user' 
                    AND column_name = 'isVerified'
                );
            `);
            
            if (!isVerifiedExists[0].exists) {
                await queryRunner.query(`
                    ALTER TABLE "user" ADD COLUMN "isVerified" boolean NOT NULL DEFAULT false
                `);
            }

            // Check and add subscription-related columns
            const subscriptionColumns = [
                { name: 'subscriptionEndDate', type: 'TIMESTAMP WITH TIME ZONE NULL' },
                { name: 'pausedSubscriptionId', type: 'varchar NULL' },
                { name: 'giftCreditPlan', type: 'varchar(10) NULL' },
                { name: 'giftCreditEndDate', type: 'TIMESTAMP WITH TIME ZONE NULL' },
                { name: 'previousSubscriptionPlan', type: 'varchar(10) NULL' },
                { name: 'barklePlusCredits', type: 'integer NOT NULL DEFAULT 0' },
                { name: 'miniPlusCredits', type: 'integer NOT NULL DEFAULT 0' },
                { name: 'barklePlusCreditsExpiry', type: 'TIMESTAMP WITH TIME ZONE NULL' },
                { name: 'miniPlusCreditsExpiry', type: 'TIMESTAMP WITH TIME ZONE NULL' }
            ];

            for (const column of subscriptionColumns) {
                const columnExists = await queryRunner.query(`
                    SELECT EXISTS (
                        SELECT FROM information_schema.columns 
                        WHERE table_name = 'user' 
                        AND column_name = '${column.name}'
                    );
                `);
                
                if (!columnExists[0].exists) {
                    await queryRunner.query(`
                        ALTER TABLE "user" ADD COLUMN "${column.name}" ${column.type}
                    `);
                }
            }

            // Check and add subscriptionStatus column with enum
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
        }
    }

    async down(queryRunner) {
        // Remove columns from user table
        const userTableExists = await queryRunner.hasTable('user');
        if (userTableExists) {
            const userColumns = [
                'miniPlusCreditsExpiry',
                'barklePlusCreditsExpiry',
                'miniPlusCredits',
                'barklePlusCredits',
                'subscriptionStatus',
                'previousSubscriptionPlan',
                'giftCreditEndDate',
                'giftCreditPlan',
                'pausedSubscriptionId',
                'subscriptionEndDate',
                'isVerified'
            ];

            for (const columnName of userColumns) {
                await queryRunner.query(`ALTER TABLE "user" DROP COLUMN IF EXISTS "${columnName}"`);
            }

            // Drop the enum type
            await queryRunner.query(`DROP TYPE IF EXISTS "user_subscriptionstatus_enum"`);
        }

        // Remove columns from meta table
        const metaTableExists = await queryRunner.hasTable('meta');
        if (metaTableExists) {
            const metaColumns = [
                'price_id_gift_year_mplus',
                'price_id_gift_month_mplus',
                'price_id_gift_year_plus',
                'price_id_gift_month_plus',
                'preReleaseAllowedUserIds',
                'preReleaseAllowedRoles',
                'preReleaseMode'
            ];

            for (const columnName of metaColumns) {
                await queryRunner.query(`ALTER TABLE "meta" DROP COLUMN IF EXISTS "${columnName}"`);
            }
        }
    }
}
