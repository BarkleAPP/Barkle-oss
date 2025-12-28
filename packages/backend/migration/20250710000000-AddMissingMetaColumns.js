export class AddMissingMetaColumns20250710000000 {
    name = 'AddMissingMetaColumns20250710000000'
    
    async up(queryRunner) {
        // Check if meta table exists first
        const metaTableExists = await queryRunner.hasTable('meta');
        if (!metaTableExists) {
            return; // Skip if meta table doesn't exist
        }
        
        // Add preReleaseMode column if it doesn't exist
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
        
        // Add preReleaseAllowedRoles column if it doesn't exist
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
        
        // Add preReleaseAllowedUserIds column if it doesn't exist
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
        
        // Add gift price ID columns if they don't exist
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
                    ALTER TABLE "meta" ADD COLUMN "${columnName}" varchar(128)
                `);
            }
        }
    }

    async down(queryRunner) {
        // Check if meta table exists first
        const metaTableExists = await queryRunner.hasTable('meta');
        if (!metaTableExists) {
            return; // Skip if meta table doesn't exist
        }
        
        // Remove the added columns if they exist
        await queryRunner.query(`ALTER TABLE "meta" DROP COLUMN IF EXISTS "price_id_gift_year_mplus"`);
        await queryRunner.query(`ALTER TABLE "meta" DROP COLUMN IF EXISTS "price_id_gift_month_mplus"`);
        await queryRunner.query(`ALTER TABLE "meta" DROP COLUMN IF EXISTS "price_id_gift_year_plus"`);
        await queryRunner.query(`ALTER TABLE "meta" DROP COLUMN IF EXISTS "price_id_gift_month_plus"`);
        await queryRunner.query(`ALTER TABLE "meta" DROP COLUMN IF EXISTS "preReleaseAllowedUserIds"`);
        await queryRunner.query(`ALTER TABLE "meta" DROP COLUMN IF EXISTS "preReleaseAllowedRoles"`);
        await queryRunner.query(`ALTER TABLE "meta" DROP COLUMN IF EXISTS "preReleaseMode"`);
    }
}
