export class AddMetadataToGiftedSubscription20250521100000 {
    name = 'AddMetadataToGiftedSubscription20250521100000'
    
    async up(queryRunner) {
        // Check if metadata column exists before adding it
        const metadataExists = await queryRunner.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.columns 
                WHERE table_name = 'gifted_subscription' 
                AND column_name = 'metadata'
            );
        `);
        
        if (!metadataExists[0].exists) {
            // Add metadata field (JSONB) to gifted_subscription table
            await queryRunner.query(`
                ALTER TABLE "gifted_subscription" ADD COLUMN "metadata" JSONB NULL
            `);
        }
        
        // Add column comment for better documentation (this should not fail even if column already existed)
        await queryRunner.query(`COMMENT ON COLUMN "gifted_subscription"."metadata" IS 'JSON metadata for tracking subscription transitions and states.'`);
    }

    async down(queryRunner) {
        // Remove the added column if it exists
        await queryRunner.query(`ALTER TABLE "gifted_subscription" DROP COLUMN IF EXISTS "metadata"`);
    }
}
