export class AddSocialProofToNotes20251011000000 {
	name = 'AddSocialProofToNotes20251011000000'

	async up(queryRunner) {
		// Check if columns already exist (in case the previous migration partially succeeded)
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
	}

	async down(queryRunner) {
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