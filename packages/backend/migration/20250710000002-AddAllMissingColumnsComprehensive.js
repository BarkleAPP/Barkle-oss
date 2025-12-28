export class AddAllMissingColumnsComprehensive20250710000002 {
    name = 'AddAllMissingColumnsComprehensive20250710000002'
    
    async up(queryRunner) {
        // Check if meta table exists and add missing columns
        const metaTableExists = await queryRunner.hasTable('meta');
        if (metaTableExists) {
            await this.addMissingMetaColumns(queryRunner);
        }
        
        // Check if user table exists and add missing columns
        const userTableExists = await queryRunner.hasTable('user');
        if (userTableExists) {
            await this.addMissingUserColumns(queryRunner);
        }
        
        // Check if user_profile table exists and add missing columns
        const userProfileTableExists = await queryRunner.hasTable('user_profile');
        if (userProfileTableExists) {
            await this.addMissingUserProfileColumns(queryRunner);
        }
        
        // Check if note table exists and add missing columns
        const noteTableExists = await queryRunner.hasTable('note');
        if (noteTableExists) {
            await this.addMissingNoteColumns(queryRunner);
        }
    }
    
    async addMissingMetaColumns(queryRunner) {
        const metaColumns = [
            { name: 'preReleaseMode', type: 'boolean', default: 'false' },
            { name: 'preReleaseAllowedRoles', type: 'varchar(256)[]', default: "'{staff,admin,moderator,verified}'" },
            { name: 'preReleaseAllowedUserIds', type: 'varchar(32)[]', default: "'{}'" },
            { name: 'product_id_month', type: 'varchar(128)', default: null },
            { name: 'product_id_mp', type: 'varchar(128)', default: null },
            { name: 'price_id_month', type: 'varchar(128)', default: null },
            { name: 'price_id_year', type: 'varchar(128)', default: null },
            { name: 'price_id_month_mp', type: 'varchar(128)', default: null },
            { name: 'price_id_year_mp', type: 'varchar(128)', default: null },
            { name: 'price_id_gift_month_plus', type: 'varchar(128)', default: null },
            { name: 'price_id_gift_year_plus', type: 'varchar(128)', default: null },
            { name: 'price_id_gift_month_mplus', type: 'varchar(128)', default: null },
            { name: 'price_id_gift_year_mplus', type: 'varchar(128)', default: null },
            { name: 'stripe_key', type: 'varchar(128)', default: null },
            { name: 'stripe_webhook_secret', type: 'varchar(128)', default: null },
            { name: 'mux_access', type: 'varchar(128)', default: null },
            { name: 'mux_secret_key', type: 'varchar(128)', default: null },
            { name: 'mux_token_id', type: 'varchar(128)', default: null },
            { name: 'mux_webhook_secret', type: 'varchar(128)', default: null }
        ];
        
        for (const column of metaColumns) {
            const exists = await queryRunner.query(`
                SELECT EXISTS (
                    SELECT FROM information_schema.columns 
                    WHERE table_name = 'meta' 
                    AND column_name = '${column.name}'
                );
            `);
            
            if (!exists[0].exists) {
                let sql = `ALTER TABLE "meta" ADD COLUMN "${column.name}" ${column.type}`;
                if (column.default !== null) {
                    if (column.type === 'boolean') {
                        sql += ` NOT NULL DEFAULT ${column.default}`;
                    } else if (column.type.includes('[]')) {
                        sql += ` NOT NULL DEFAULT ${column.default}`;
                    } else {
                        sql += ` NULL`;
                    }
                } else {
                    sql += ` NULL`;
                }
                await queryRunner.query(sql);
            }
        }
    }
    
    async addMissingUserColumns(queryRunner) {
        // First create the subscription status enum if it doesn't exist
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
        
        const userColumns = [
            { name: 'isVerified', type: 'boolean', default: 'false' },
            { name: 'isStaff', type: 'boolean', default: 'false' },
            { name: 'isTranslator', type: 'boolean', default: 'false' },
            { name: 'hasAlgoBeta', type: 'boolean', default: 'false' },
            { name: 'isOG', type: 'boolean', default: 'false' },
            { name: 'isPlus', type: 'boolean', default: 'false' },
            { name: 'isMPlus', type: 'boolean', default: 'false' },
            { name: 'isLive', type: 'boolean', default: 'false' },
            { name: 'stripe_user', type: 'varchar(255)', default: null },
            { name: 'liveUrl', type: 'varchar(512)', default: null },
            { name: 'avatarDecorations', type: 'jsonb', default: "'[]'" },
            { name: 'subscriptionEndDate', type: 'TIMESTAMP WITH TIME ZONE', default: null },
            { name: 'pausedSubscriptionId', type: 'varchar', default: null },
            { name: 'giftCreditPlan', type: 'varchar(10)', default: null },
            { name: 'giftCreditEndDate', type: 'TIMESTAMP WITH TIME ZONE', default: null },
            { name: 'previousSubscriptionPlan', type: 'varchar(10)', default: null },
            { name: 'subscriptionStatus', type: '"user_subscriptionstatus_enum"', default: "'FREE'" },
            { name: 'barklePlusCredits', type: 'integer', default: '0' },
            { name: 'miniPlusCredits', type: 'integer', default: '0' },
            { name: 'barklePlusCreditsExpiry', type: 'TIMESTAMP WITH TIME ZONE', default: null },
            { name: 'miniPlusCreditsExpiry', type: 'TIMESTAMP WITH TIME ZONE', default: null }
        ];
        
        for (const column of userColumns) {
            const exists = await queryRunner.query(`
                SELECT EXISTS (
                    SELECT FROM information_schema.columns 
                    WHERE table_name = 'user' 
                    AND column_name = '${column.name}'
                );
            `);
            
            if (!exists[0].exists) {
                let sql = `ALTER TABLE "user" ADD COLUMN "${column.name}" ${column.type}`;
                if (column.default !== null) {
                    if (column.type === 'boolean' || column.type === 'integer' || column.type.includes('enum')) {
                        sql += ` NOT NULL DEFAULT ${column.default}`;
                    } else if (column.type === 'jsonb') {
                        sql += ` NOT NULL DEFAULT ${column.default}`;
                    } else {
                        sql += ` NULL`;
                    }
                } else {
                    sql += ` NULL`;
                }
                await queryRunner.query(sql);
            }
        }
    }
    
    async addMissingUserProfileColumns(queryRunner) {
        const userProfileColumns = [
            { name: 'profileCss', type: 'text', default: null },
            { name: 'noCrawle', type: 'boolean', default: 'false' },
            { name: 'userHost', type: 'varchar(128)', default: null }
        ];
        
        for (const column of userProfileColumns) {
            const exists = await queryRunner.query(`
                SELECT EXISTS (
                    SELECT FROM information_schema.columns 
                    WHERE table_name = 'user_profile' 
                    AND column_name = '${column.name}'
                );
            `);
            
            if (!exists[0].exists) {
                let sql = `ALTER TABLE "user_profile" ADD COLUMN "${column.name}" ${column.type}`;
                if (column.default !== null) {
                    if (column.type === 'boolean') {
                        sql += ` NOT NULL DEFAULT ${column.default}`;
                    } else {
                        sql += ` NULL`;
                    }
                } else {
                    sql += ` NULL`;
                }
                await queryRunner.query(sql);
            }
        }
    }
    
    async addMissingNoteColumns(queryRunner) {
        const noteColumns = [
            { name: 'barkleFor', type: 'varchar(128)', default: null },
            { name: 'threadId', type: 'varchar(32)', default: null },
            { name: 'url', type: 'varchar(512)', default: null }
        ];
        
        for (const column of noteColumns) {
            const exists = await queryRunner.query(`
                SELECT EXISTS (
                    SELECT FROM information_schema.columns 
                    WHERE table_name = 'note' 
                    AND column_name = '${column.name}'
                );
            `);
            
            if (!exists[0].exists) {
                let sql = `ALTER TABLE "note" ADD COLUMN "${column.name}" ${column.type}`;
                if (column.default !== null) {
                    sql += ` NOT NULL DEFAULT ${column.default}`;
                } else {
                    sql += ` NULL`;
                }
                await queryRunner.query(sql);
            }
        }
    }

    async down(queryRunner) {
        // Check if note table exists and remove columns
        const noteTableExists = await queryRunner.hasTable('note');
        if (noteTableExists) {
            const noteColumns = ['url', 'threadId', 'barkleFor'];
            for (const columnName of noteColumns) {
                await queryRunner.query(`ALTER TABLE "note" DROP COLUMN IF EXISTS "${columnName}"`);
            }
        }
        
        // Check if user_profile table exists and remove columns
        const userProfileTableExists = await queryRunner.hasTable('user_profile');
        if (userProfileTableExists) {
            const userProfileColumns = ['userHost', 'noCrawle', 'profileCss'];
            for (const columnName of userProfileColumns) {
                await queryRunner.query(`ALTER TABLE "user_profile" DROP COLUMN IF EXISTS "${columnName}"`);
            }
        }
        
        // Check if user table exists and remove columns
        const userTableExists = await queryRunner.hasTable('user');
        if (userTableExists) {
            const userColumns = [
                'miniPlusCreditsExpiry', 'barklePlusCreditsExpiry', 'miniPlusCredits', 
                'barklePlusCredits', 'subscriptionStatus', 'previousSubscriptionPlan',
                'giftCreditEndDate', 'giftCreditPlan', 'pausedSubscriptionId', 
                'subscriptionEndDate', 'avatarDecorations', 'liveUrl', 'stripe_user',
                'isLive', 'isMPlus', 'isPlus', 'isOG', 'hasAlgoBeta', 'isTranslator', 
                'isStaff', 'isVerified'
            ];
            
            for (const columnName of userColumns) {
                await queryRunner.query(`ALTER TABLE "user" DROP COLUMN IF EXISTS "${columnName}"`);
            }
            
            // Drop the enum type if no other tables are using it
            await queryRunner.query(`DROP TYPE IF EXISTS "user_subscriptionstatus_enum"`);
        }
        
        // Check if meta table exists and remove columns
        const metaTableExists = await queryRunner.hasTable('meta');
        if (metaTableExists) {
            const metaColumns = [
                'mux_webhook_secret', 'mux_token_id', 'mux_secret_key', 'mux_access',
                'stripe_webhook_secret', 'stripe_key', 'price_id_gift_year_mplus', 
                'price_id_gift_month_mplus', 'price_id_gift_year_plus', 'price_id_gift_month_plus',
                'price_id_year_mp', 'price_id_month_mp', 'price_id_year', 'price_id_month',
                'product_id_mp', 'product_id_month', 'preReleaseAllowedUserIds', 
                'preReleaseAllowedRoles', 'preReleaseMode'
            ];
            
            for (const columnName of metaColumns) {
                await queryRunner.query(`ALTER TABLE "meta" DROP COLUMN IF EXISTS "${columnName}"`);
            }
        }
    }
}
