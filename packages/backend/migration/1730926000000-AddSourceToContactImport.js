export class AddSourceToContactImport1730926000000 {
    name = 'AddSourceToContactImport1730926000000'

    async up(queryRunner) {
        // Add source column to contact_import table if it doesn't exist
        await queryRunner.query(`
            DO $$ 
            BEGIN 
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns 
                    WHERE table_name = 'contact_import' 
                    AND column_name = 'source'
                ) THEN
                    ALTER TABLE "contact_import" 
                    ADD COLUMN "source" varchar(32) DEFAULT 'import';
                    
                    COMMENT ON COLUMN "contact_import"."source" IS 'Source of the contact (e.g., import, suggestion, inference)';
                END IF;
            END $$;
        `);

        console.log('✅ Added source column to contact_import table');
    }

    async down(queryRunner) {
        // Remove source column
        await queryRunner.query(`
            ALTER TABLE "contact_import" DROP COLUMN IF EXISTS "source"
        `);

        console.log('✅ Removed source column from contact_import table');
    }
}
