export class AddAllMissingColumns20250710000001 {
    name = 'AddAllMissingColumns20250710000001'
    
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
    }
    
    async addMissingMetaColumns(queryRunner) {
        const metaColumns = [
            { name: 'preReleaseMode', type: 'boolean', default: 'false' },
            { name: 'preReleaseAllowedRoles', type: 'varchar(256)[]', default: "'{staff,admin,moderator,verified}'" },
            { name: 'preReleaseAllowedUserIds', type: 'varchar(32)[]', default: "'{}'" },
            { name: 'price_id_gift_month_plus', type: 'varchar(128)', default: null },
            { name: 'price_id_gift_year_plus', type: 'varchar(128)', default: null },
            { name: 'price_id_gift_month_mplus', type: 'varchar(128)', default: null },
            { name: 'price_id_gift_year_mplus', type: 'varchar(128)', default: null }
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

    async down(queryRunner) {
        // Check if user table exists and remove columns
        const userTableExists = await queryRunner.hasTable('user');
        if (userTableExists) {
            const userColumns = [
                'miniPlusCreditsExpiry', 'barklePlusCreditsExpiry', 'miniPlusCredits', 
                'barklePlusCredits', 'subscriptionStatus', 'previousSubscriptionPlan',
                'giftCreditEndDate', 'giftCreditPlan', 'pausedSubscriptionId', 
                'subscriptionEndDate', 'isLive', 'isMPlus', 'isPlus', 'isOG', 
                'hasAlgoBeta', 'isTranslator', 'isStaff', 'isVerified'
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
                'price_id_gift_year_mplus', 'price_id_gift_month_mplus',
                'price_id_gift_year_plus', 'price_id_gift_month_plus',
                'preReleaseAllowedUserIds', 'preReleaseAllowedRoles', 'preReleaseMode'
            ];
            
            for (const columnName of metaColumns) {
                await queryRunner.query(`ALTER TABLE "meta" DROP COLUMN IF EXISTS "${columnName}"`);
            }
        }
    }
}
