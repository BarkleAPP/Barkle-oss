export class AddPreReleaseModeToMeta20250524000000 {
    name = 'AddPreReleaseModeToMeta20250524000000'
    
    async up(queryRunner) {
        // Check if meta table exists first
        const metaTableExists = await queryRunner.hasTable('meta');
        if (!metaTableExists) {
            return; // Skip if meta table doesn't exist
        }
        
        // Check if preReleaseMode column exists before adding it
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
        
        // Check if preReleaseAllowedRoles column exists before adding it
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
        
        // Check if preReleaseAllowedUserIds column exists before adding it
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
    }
    
    async down(queryRunner) {
        // Check if meta table exists first
        const metaTableExists = await queryRunner.hasTable('meta');
        if (!metaTableExists) {
            return; // Skip if meta table doesn't exist
        }
        
        // Remove the added columns if they exist
        await queryRunner.query(`ALTER TABLE "meta" DROP COLUMN IF EXISTS "preReleaseAllowedUserIds"`);
        await queryRunner.query(`ALTER TABLE "meta" DROP COLUMN IF EXISTS "preReleaseAllowedRoles"`);
        await queryRunner.query(`ALTER TABLE "meta" DROP COLUMN IF EXISTS "preReleaseMode"`);
    }
}
