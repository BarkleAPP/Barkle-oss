export class AddCategoryToNotes20251201000000 {
    name = 'AddCategoryToNotes20251201000000'

    async up(queryRunner) {
        // Check if the column already exists
        const columns = await queryRunner.query(`
            SELECT column_name
            FROM information_schema.columns
            WHERE table_name = 'note' AND column_name = 'category'
        `);

        if (columns.length === 0) {
            // Add category column to note table
            await queryRunner.query(`ALTER TABLE "note" ADD COLUMN "category" character varying(64)`);

            // Add comment to the column
            await queryRunner.query(`COMMENT ON COLUMN "note"."category" IS 'The category of the note (e.g., technology, music, sports).'`);
        }

        // Check if the index already exists
        const indexes = await queryRunner.query(`
            SELECT indexname
            FROM pg_indexes
            WHERE tablename = 'note' AND indexname = 'IDX_note_category'
        `);

        if (indexes.length === 0) {
            // Add index for category column for better query performance
            await queryRunner.query(`CREATE INDEX "IDX_note_category" ON "note" ("category")`);
        }
    }

    async down(queryRunner) {
        // Check if the index exists before dropping
        const indexes = await queryRunner.query(`
            SELECT indexname
            FROM pg_indexes
            WHERE tablename = 'note' AND indexname = 'IDX_note_category'
        `);

        if (indexes.length > 0) {
            await queryRunner.query(`DROP INDEX "IDX_note_category"`);
        }

        // Check if the column exists before dropping
        const columns = await queryRunner.query(`
            SELECT column_name
            FROM information_schema.columns
            WHERE table_name = 'note' AND column_name = 'category'
        `);

        if (columns.length > 0) {
            await queryRunner.query(`ALTER TABLE "note" DROP COLUMN "category"`);
        }
    }
}