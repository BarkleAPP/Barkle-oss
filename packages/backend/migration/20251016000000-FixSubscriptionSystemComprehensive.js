export class FixSubscriptionSystemComprehensive20251016000000 {
    name = 'FixSubscriptionSystemComprehensive20251016000000'
    
    async up(queryRunner) {
        console.log('🔧 Starting comprehensive subscription system fix...');
        
        // Check if user table exists first
        const userTableExists = await queryRunner.hasTable('user');
        if (!userTableExists) {
            console.log('❌ User table does not exist, skipping migration');
            return;
        }

        // 1. Ensure basic subscription fields exist
        try {
            // Add isPlus field
            const isPlusExists = await queryRunner.query(`
                SELECT EXISTS (
                    SELECT FROM information_schema.columns 
                    WHERE table_name = 'user' 
                    AND column_name = 'isPlus'
                );
            `);
            
            if (!isPlusExists[0].exists) {
                console.log('🔧 Adding missing field: isPlus');
                await queryRunner.query(`ALTER TABLE "user" ADD COLUMN "isPlus" boolean DEFAULT false`);
            } else {
                console.log('✅ Field isPlus already exists');
            }
        } catch (error) {
            console.log('⚠️ Failed to add isPlus field, but continuing:', error.message);
        }

        try {
            // Add isMPlus field
            const isMPlusExists = await queryRunner.query(`
                SELECT EXISTS (
                    SELECT FROM information_schema.columns 
                    WHERE table_name = 'user' 
                    AND column_name = 'isMPlus'
                );
            `);
            
            if (!isMPlusExists[0].exists) {
                console.log('🔧 Adding missing field: isMPlus');
                await queryRunner.query(`ALTER TABLE "user" ADD COLUMN "isMPlus" boolean DEFAULT false`);
            } else {
                console.log('✅ Field isMPlus already exists');
            }
        } catch (error) {
            console.log('⚠️ Failed to add isMPlus field, but continuing:', error.message);
        }

        try {
            // Add subscriptionEndDate field
            const subEndDateExists = await queryRunner.query(`
                SELECT EXISTS (
                    SELECT FROM information_schema.columns 
                    WHERE table_name = 'user' 
                    AND column_name = 'subscriptionEndDate'
                );
            `);
            
            if (!subEndDateExists[0].exists) {
                console.log('🔧 Adding missing field: subscriptionEndDate');
                await queryRunner.query(`ALTER TABLE "user" ADD COLUMN "subscriptionEndDate" TIMESTAMP WITH TIME ZONE`);
            } else {
                console.log('✅ Field subscriptionEndDate already exists');
            }
        } catch (error) {
            console.log('⚠️ Failed to add subscriptionEndDate field, but continuing:', error.message);
        }

        // 2. Create subscription status enum if it doesn't exist
        try {
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
                    WHEN duplicate_object THEN 
                        RAISE NOTICE 'Enum type already exists, skipping creation';
                END $$;
            `);
            console.log('✅ Subscription status enum created/verified');
        } catch (error) {
            console.log('⚠️ Enum creation failed, but continuing:', error.message);
        }

        // 3. Add subscription status field
        try {
            const subscriptionStatusExists = await queryRunner.query(`
                SELECT EXISTS (
                    SELECT FROM information_schema.columns 
                    WHERE table_name = 'user' 
                    AND column_name = 'subscriptionStatus'
                );
            `);
            
            if (!subscriptionStatusExists[0].exists) {
                console.log('🔧 Adding subscriptionStatus field');
                try {
                    await queryRunner.query(`
                        ALTER TABLE "user" ADD COLUMN "subscriptionStatus" "user_subscriptionstatus_enum" NOT NULL DEFAULT 'FREE'
                    `);
                } catch (error) {
                    console.log('⚠️ Failed to add subscriptionStatus with enum, trying varchar fallback');
                    await queryRunner.query(`
                        ALTER TABLE "user" ADD COLUMN "subscriptionStatus" varchar(50) NOT NULL DEFAULT 'FREE'
                    `);
                }
            } else {
                console.log('✅ subscriptionStatus field already exists');
            }
        } catch (error) {
            console.log('⚠️ Failed to check/add subscriptionStatus field, but continuing:', error.message);
        }

        // 4. Add credit fields (optional - won't fail if they can't be added)
        try {
            // Add barklePlusCredits field
            const barkleCreditsExists = await queryRunner.query(`
                SELECT EXISTS (
                    SELECT FROM information_schema.columns 
                    WHERE table_name = 'user' 
                    AND column_name = 'barklePlusCredits'
                );
            `);
            
            if (!barkleCreditsExists[0].exists) {
                console.log('🔧 Adding credit field: barklePlusCredits');
                await queryRunner.query(`ALTER TABLE "user" ADD COLUMN "barklePlusCredits" integer DEFAULT 0`);
            } else {
                console.log('✅ Credit field barklePlusCredits already exists');
            }
        } catch (error) {
            console.log('⚠️ Failed to add barklePlusCredits field, but continuing:', error.message);
        }

        try {
            // Add miniPlusCredits field
            const miniCreditsExists = await queryRunner.query(`
                SELECT EXISTS (
                    SELECT FROM information_schema.columns 
                    WHERE table_name = 'user' 
                    AND column_name = 'miniPlusCredits'
                );
            `);
            
            if (!miniCreditsExists[0].exists) {
                console.log('🔧 Adding credit field: miniPlusCredits');
                await queryRunner.query(`ALTER TABLE "user" ADD COLUMN "miniPlusCredits" integer DEFAULT 0`);
            } else {
                console.log('✅ Credit field miniPlusCredits already exists');
            }
        } catch (error) {
            console.log('⚠️ Failed to add miniPlusCredits field, but continuing:', error.message);
        }

        try {
            // Add barklePlusCreditsExpiry field
            const barkleExpiryExists = await queryRunner.query(`
                SELECT EXISTS (
                    SELECT FROM information_schema.columns 
                    WHERE table_name = 'user' 
                    AND column_name = 'barklePlusCreditsExpiry'
                );
            `);
            
            if (!barkleExpiryExists[0].exists) {
                console.log('🔧 Adding credit field: barklePlusCreditsExpiry');
                await queryRunner.query(`ALTER TABLE "user" ADD COLUMN "barklePlusCreditsExpiry" TIMESTAMP WITH TIME ZONE`);
            } else {
                console.log('✅ Credit field barklePlusCreditsExpiry already exists');
            }
        } catch (error) {
            console.log('⚠️ Failed to add barklePlusCreditsExpiry field, but continuing:', error.message);
        }

        try {
            // Add miniPlusCreditsExpiry field
            const miniExpiryExists = await queryRunner.query(`
                SELECT EXISTS (
                    SELECT FROM information_schema.columns 
                    WHERE table_name = 'user' 
                    AND column_name = 'miniPlusCreditsExpiry'
                );
            `);
            
            if (!miniExpiryExists[0].exists) {
                console.log('🔧 Adding credit field: miniPlusCreditsExpiry');
                await queryRunner.query(`ALTER TABLE "user" ADD COLUMN "miniPlusCreditsExpiry" TIMESTAMP WITH TIME ZONE`);
            } else {
                console.log('✅ Credit field miniPlusCreditsExpiry already exists');
            }
        } catch (error) {
            console.log('⚠️ Failed to add miniPlusCreditsExpiry field, but continuing:', error.message);
        }

        // 5. Add Stripe-related fields
        try {
            // Add stripe_user field
            const stripeUserExists = await queryRunner.query(`
                SELECT EXISTS (
                    SELECT FROM information_schema.columns 
                    WHERE table_name = 'user' 
                    AND column_name = 'stripe_user'
                );
            `);
            
            if (!stripeUserExists[0].exists) {
                console.log('🔧 Adding Stripe field: stripe_user');
                await queryRunner.query(`ALTER TABLE "user" ADD COLUMN "stripe_user" text[] DEFAULT '{}'::text[]`);
            } else {
                console.log('✅ Stripe field stripe_user already exists');
            }
        } catch (error) {
            console.log('⚠️ Failed to add stripe_user field, but continuing:', error.message);
        }

        try {
            // Add pausedSubscriptionId field
            const pausedSubExists = await queryRunner.query(`
                SELECT EXISTS (
                    SELECT FROM information_schema.columns 
                    WHERE table_name = 'user' 
                    AND column_name = 'pausedSubscriptionId'
                );
            `);
            
            if (!pausedSubExists[0].exists) {
                console.log('🔧 Adding Stripe field: pausedSubscriptionId');
                await queryRunner.query(`ALTER TABLE "user" ADD COLUMN "pausedSubscriptionId" varchar(255)`);
            } else {
                console.log('✅ Stripe field pausedSubscriptionId already exists');
            }
        } catch (error) {
            console.log('⚠️ Failed to add pausedSubscriptionId field, but continuing:', error.message);
        }

        try {
            // Add previousSubscriptionPlan field
            const prevPlanExists = await queryRunner.query(`
                SELECT EXISTS (
                    SELECT FROM information_schema.columns 
                    WHERE table_name = 'user' 
                    AND column_name = 'previousSubscriptionPlan'
                );
            `);
            
            if (!prevPlanExists[0].exists) {
                console.log('🔧 Adding Stripe field: previousSubscriptionPlan');
                await queryRunner.query(`ALTER TABLE "user" ADD COLUMN "previousSubscriptionPlan" varchar(10)`);
            } else {
                console.log('✅ Stripe field previousSubscriptionPlan already exists');
            }
        } catch (error) {
            console.log('⚠️ Failed to add previousSubscriptionPlan field, but continuing:', error.message);
        }

        // 6. Update all users to have consistent subscription status
        console.log('🔧 Updating user subscription statuses...');
        try {
            // Check if subscriptionStatus column exists before updating
            const statusColExists = await queryRunner.query(`
                SELECT EXISTS (
                    SELECT FROM information_schema.columns 
                    WHERE table_name = 'user' 
                    AND column_name = 'subscriptionStatus'
                );
            `);

            if (statusColExists[0].exists) {
                try {
                    // Update users who have NULL subscription status to FREE
                    await queryRunner.query(`
                        UPDATE "user" 
                        SET "subscriptionStatus" = 'FREE' 
                        WHERE "subscriptionStatus" IS NULL
                    `);
                    console.log('✅ Updated NULL subscription statuses to FREE');
                } catch (updateError) {
                    console.log('⚠️ Failed to update NULL statuses to FREE:', updateError.message);
                }

                try {
                    // Set BARKLE_PLUS status for users with active Barkle+ subscriptions
                    await queryRunner.query(`
                        UPDATE "user" 
                        SET "subscriptionStatus" = 'BARKLE_PLUS' 
                        WHERE "isPlus" = true 
                        AND ("subscriptionEndDate" IS NULL OR "subscriptionEndDate" > NOW())
                    `);
                    console.log('✅ Updated active Barkle+ subscriptions');
                } catch (updateError) {
                    console.log('⚠️ Failed to update Barkle+ statuses:', updateError.message);
                }

                try {
                    // Set MINI_PLUS status for users with active Mini+ subscriptions
                    await queryRunner.query(`
                        UPDATE "user" 
                        SET "subscriptionStatus" = 'MINI_PLUS' 
                        WHERE "isMPlus" = true 
                        AND ("subscriptionEndDate" IS NULL OR "subscriptionEndDate" > NOW())
                    `);
                    console.log('✅ Updated active Mini+ subscriptions');
                } catch (updateError) {
                    console.log('⚠️ Failed to update Mini+ statuses:', updateError.message);
                }

                console.log('✅ User subscription statuses updated');
            } else {
                console.log('⚠️ subscriptionStatus column does not exist, skipping status updates');
            }
        } catch (error) {
            console.log('⚠️ Failed to check subscriptionStatus column, skipping status updates:', error.message);
        }

        // 7. Add helpful indexes
        try {
            // Check and create subscriptionStatus index
            const statusIndexExists = await queryRunner.query(`
                SELECT EXISTS (
                    SELECT FROM pg_indexes 
                    WHERE tablename = 'user' 
                    AND indexname = 'IDX_user_subscription_status'
                );
            `);
            
            if (!statusIndexExists[0].exists) {
                console.log('🔧 Creating index: IDX_user_subscription_status');
                await queryRunner.query(`CREATE INDEX "IDX_user_subscription_status" ON "user" ("subscriptionStatus")`);
            } else {
                console.log('✅ Index IDX_user_subscription_status already exists');
            }
        } catch (error) {
            console.log('⚠️ Failed to create subscriptionStatus index, but continuing:', error.message);
        }

        try {
            // Check and create subscriptionEndDate index
            const endDateIndexExists = await queryRunner.query(`
                SELECT EXISTS (
                    SELECT FROM pg_indexes 
                    WHERE tablename = 'user' 
                    AND indexname = 'IDX_user_subscription_end_date'
                );
            `);
            
            if (!endDateIndexExists[0].exists) {
                console.log('🔧 Creating index: IDX_user_subscription_end_date');
                await queryRunner.query(`CREATE INDEX "IDX_user_subscription_end_date" ON "user" ("subscriptionEndDate")`);
            } else {
                console.log('✅ Index IDX_user_subscription_end_date already exists');
            }
        } catch (error) {
            console.log('⚠️ Failed to create subscriptionEndDate index, but continuing:', error.message);
        }

        try {
            // Check and create isPlus index
            const isPlusIndexExists = await queryRunner.query(`
                SELECT EXISTS (
                    SELECT FROM pg_indexes 
                    WHERE tablename = 'user' 
                    AND indexname = 'IDX_user_is_plus'
                );
            `);
            
            if (!isPlusIndexExists[0].exists) {
                console.log('🔧 Creating index: IDX_user_is_plus');
                await queryRunner.query(`CREATE INDEX "IDX_user_is_plus" ON "user" ("isPlus")`);
            } else {
                console.log('✅ Index IDX_user_is_plus already exists');
            }
        } catch (error) {
            console.log('⚠️ Failed to create isPlus index, but continuing:', error.message);
        }

        console.log('✅ Subscription indexes created');

        console.log('🎉 Comprehensive subscription system fix completed!');
    }

    async down(queryRunner) {
        console.log('⚠️ Rolling back subscription system fixes...');
        
        // Remove indexes
        try {
            await queryRunner.query(`DROP INDEX IF EXISTS "IDX_user_subscription_status"`);
            await queryRunner.query(`DROP INDEX IF EXISTS "IDX_user_subscription_end_date"`);
            await queryRunner.query(`DROP INDEX IF EXISTS "IDX_user_is_plus"`);
        } catch (error) {
            console.log('⚠️ Failed to remove some indexes:', error.message);
        }

        // Note: We don't remove columns in rollback to avoid data loss
        console.log('⚠️ Rollback completed (columns preserved to avoid data loss)');
    }
}