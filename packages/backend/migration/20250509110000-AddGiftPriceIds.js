export class AddGiftPriceIds20250509110000 {
    name = 'AddGiftPriceIds20250509110000'
    
    async up(queryRunner) {
        // Check if meta table exists before adding columns
        const metaTableExists = await queryRunner.hasTable('meta');
        if (metaTableExists) {
            await queryRunner.query(`ALTER TABLE meta ADD COLUMN "price_id_gift_month_plus" varchar(128)`);
            await queryRunner.query(`ALTER TABLE meta ADD COLUMN "price_id_gift_year_plus" varchar(128)`);
            await queryRunner.query(`ALTER TABLE meta ADD COLUMN "price_id_gift_month_mplus" varchar(128)`);
            await queryRunner.query(`ALTER TABLE meta ADD COLUMN "price_id_gift_year_mplus" varchar(128)`);
        }
    }

    async down(queryRunner) {
        // Check if meta table exists before dropping columns
        const metaTableExists = await queryRunner.hasTable('meta');
        if (metaTableExists) {
            await queryRunner.query(`ALTER TABLE meta DROP COLUMN "price_id_gift_month_plus"`);
            await queryRunner.query(`ALTER TABLE meta DROP COLUMN "price_id_gift_year_plus"`);
            await queryRunner.query(`ALTER TABLE meta DROP COLUMN "price_id_gift_month_mplus"`);
            await queryRunner.query(`ALTER TABLE meta DROP COLUMN "price_id_gift_year_mplus"`);
        }
    }
}
