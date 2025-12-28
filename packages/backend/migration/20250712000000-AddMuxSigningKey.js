export class AddMuxSigningKey20250712000000 {
    name = 'AddMuxSigningKey20250712000000'
    
    async up(queryRunner) {
        // Check if meta table exists first
        const metaTableExists = await queryRunner.hasTable('meta');
        if (!metaTableExists) {
            return; // Skip if meta table doesn't exist
        }
        
        // Add mux_signing_key_id column if it doesn't exist
        const signingKeyIdExists = await queryRunner.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.columns 
                WHERE table_name = 'meta' 
                AND column_name = 'mux_signing_key_id'
            );
        `);
        
        if (!signingKeyIdExists[0].exists) {
            await queryRunner.query(`
                ALTER TABLE "meta" ADD COLUMN "mux_signing_key_id" character varying(256)
            `);
        }
        
        // Add mux_signing_key_private column if it doesn't exist
        const signingKeyPrivateExists = await queryRunner.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.columns 
                WHERE table_name = 'meta' 
                AND column_name = 'mux_signing_key_private'
            );
        `);
        
        if (!signingKeyPrivateExists[0].exists) {
            await queryRunner.query(`
                ALTER TABLE "meta" ADD COLUMN "mux_signing_key_private" text
            `);
        }
    }

    async down(queryRunner) {
        // Remove the columns if they exist
        const metaTableExists = await queryRunner.hasTable('meta');
        if (!metaTableExists) {
            return;
        }
        
        await queryRunner.query(`ALTER TABLE "meta" DROP COLUMN IF EXISTS "mux_signing_key_private"`);
        await queryRunner.query(`ALTER TABLE "meta" DROP COLUMN IF EXISTS "mux_signing_key_id"`);
    }
}
