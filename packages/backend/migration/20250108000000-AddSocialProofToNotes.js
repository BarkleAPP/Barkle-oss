export class AddSocialProofToNotes1704672000000 {
	name = 'AddSocialProofToNotes1704672000000'

	async up(queryRunner) {
		// Check if columns already exist (in case the migration partially succeeded)
		const columns = await queryRunner.query(`
			SELECT column_name
			FROM information_schema.columns
			WHERE table_name = 'note' AND column_name IN ('engagement_score', 'trending_score', 'momentum_score', 'last_engagement_at', 'social_proof_updated_at')
		`);

		const existingColumns = columns.map(col => col.column_name);

		// Add social proof tracking columns to notes table (only if they don't exist)
		const columnsToAdd = [];
		if (!existingColumns.includes('engagement_score')) {
			columnsToAdd.push('ADD COLUMN "engagement_score" integer DEFAULT 0');
		}
		if (!existingColumns.includes('trending_score')) {
			columnsToAdd.push('ADD COLUMN "trending_score" integer DEFAULT 0');
		}
		if (!existingColumns.includes('momentum_score')) {
			columnsToAdd.push('ADD COLUMN "momentum_score" integer DEFAULT 0');
		}
		if (!existingColumns.includes('last_engagement_at')) {
			columnsToAdd.push('ADD COLUMN "last_engagement_at" TIMESTAMP WITH TIME ZONE');
		}
		if (!existingColumns.includes('social_proof_updated_at')) {
			columnsToAdd.push('ADD COLUMN "social_proof_updated_at" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP');
		}

		if (columnsToAdd.length > 0) {
			await queryRunner.query(`
				ALTER TABLE "note"
				${columnsToAdd.join(',\n\t\t\t\t')}
			`);
		}

		// Add indexes for performance (only if columns exist)
		if (!existingColumns.includes('engagement_score')) {
			await queryRunner.query(`CREATE INDEX "IDX_NOTE_ENGAGEMENT_SCORE" ON "note" ("engagement_score" DESC)`);
		}
		if (!existingColumns.includes('trending_score')) {
			await queryRunner.query(`CREATE INDEX "IDX_NOTE_TRENDING_SCORE" ON "note" ("trending_score" DESC)`);
		}
		if (!existingColumns.includes('momentum_score')) {
			await queryRunner.query(`CREATE INDEX "IDX_NOTE_MOMENTUM_SCORE" ON "note" ("momentum_score" DESC)`);
		}
		if (!existingColumns.includes('last_engagement_at')) {
			await queryRunner.query(`CREATE INDEX "IDX_NOTE_LAST_ENGAGEMENT" ON "note" ("last_engagement_at" DESC)`);
		}

		// Create a composite index for trending queries (only if trending_score column exists)
		if (!existingColumns.includes('trending_score')) {
			await queryRunner.query(`
				CREATE INDEX "IDX_NOTE_TRENDING_COMPOSITE" ON "note" 
				("createdAt" DESC, "trending_score" DESC, "visibility") 
				WHERE "visibility" = 'public' AND "localOnly" = false
			`);
		}
	}

	async down(queryRunner) {
		// Check which indexes exist before trying to drop them
		const indexes = await queryRunner.query(`
			SELECT indexname
			FROM pg_indexes
			WHERE tablename = 'note' AND indexname IN ('idx_note_trending_composite', 'idx_note_last_engagement', 'idx_note_momentum_score', 'idx_note_trending_score', 'idx_note_engagement_score')
		`);

		const existingIndexes = indexes.map(idx => idx.indexname);

		// Drop indexes that exist
		if (existingIndexes.includes('idx_note_trending_composite')) {
			await queryRunner.query(`DROP INDEX "IDX_NOTE_TRENDING_COMPOSITE"`);
		}
		if (existingIndexes.includes('idx_note_last_engagement')) {
			await queryRunner.query(`DROP INDEX "IDX_NOTE_LAST_ENGAGEMENT"`);
		}
		if (existingIndexes.includes('idx_note_momentum_score')) {
			await queryRunner.query(`DROP INDEX "IDX_NOTE_MOMENTUM_SCORE"`);
		}
		if (existingIndexes.includes('idx_note_trending_score')) {
			await queryRunner.query(`DROP INDEX "IDX_NOTE_TRENDING_SCORE"`);
		}
		if (existingIndexes.includes('idx_note_engagement_score')) {
			await queryRunner.query(`DROP INDEX "IDX_NOTE_ENGAGEMENT_SCORE"`);
		}

		// Check which columns exist before trying to drop them
		const columns = await queryRunner.query(`
			SELECT column_name
			FROM information_schema.columns
			WHERE table_name = 'note' AND column_name IN ('engagement_score', 'trending_score', 'momentum_score', 'last_engagement_at', 'social_proof_updated_at')
		`);

		const existingColumns = columns.map(col => col.column_name);

		// Drop columns that exist
		const columnsToDrop = [];
		if (existingColumns.includes('social_proof_updated_at')) {
			columnsToDrop.push('DROP COLUMN "social_proof_updated_at"');
		}
		if (existingColumns.includes('last_engagement_at')) {
			columnsToDrop.push('DROP COLUMN "last_engagement_at"');
		}
		if (existingColumns.includes('momentum_score')) {
			columnsToDrop.push('DROP COLUMN "momentum_score"');
		}
		if (existingColumns.includes('trending_score')) {
			columnsToDrop.push('DROP COLUMN "trending_score"');
		}
		if (existingColumns.includes('engagement_score')) {
			columnsToDrop.push('DROP COLUMN "engagement_score"');
		}

		if (columnsToDrop.length > 0) {
			await queryRunner.query(`
				ALTER TABLE "note"
				${columnsToDrop.join(',\n\t\t\t\t')}
			`);
		}
	}
}