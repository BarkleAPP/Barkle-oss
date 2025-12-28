export class AddMessageColumnToGiftedSubscription20251010000000 {
    name = 'AddMessageColumnToGiftedSubscription20251010000000'
    
    async up(queryRunner) {
        // Check if the column already exists to prevent errors
        const table = await queryRunner.getTable("gifted_subscription");
        const hasMessageColumn = table.findColumnByName("message");
        
        if (!hasMessageColumn) {
            await queryRunner.query(`ALTER TABLE "gifted_subscription" ADD COLUMN "message" text NULL`);
            await queryRunner.query(`COMMENT ON COLUMN "gifted_subscription"."message" IS 'Optional personalized message from the gift purchaser to the recipient.'`);
        }
    }

    async down(queryRunner) {
        // Only attempt to drop if the column exists
        const table = await queryRunner.getTable("gifted_subscription");
        const hasMessageColumn = table.findColumnByName("message");
        
        if (hasMessageColumn) {
            await queryRunner.query(`ALTER TABLE "gifted_subscription" DROP COLUMN "message"`);
        }
    }
}
