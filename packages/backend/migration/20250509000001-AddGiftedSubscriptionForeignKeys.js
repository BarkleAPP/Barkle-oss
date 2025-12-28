export class AddGiftedSubscriptionForeignKeys20250509000001 {
    name = 'AddGiftedSubscriptionForeignKeys20250509000001'

    async up(queryRunner) {
        // Check if gifted_subscription table exists and user table exists
        const giftedTableExists = await queryRunner.hasTable("gifted_subscription");
        const userTableExists = await queryRunner.hasTable("user");
        
        if (giftedTableExists && userTableExists) {
            const table = await queryRunner.getTable("gifted_subscription");
            
            // Check if foreign keys already exist
            const purchasedByFkExists = table.foreignKeys.find(fk => fk.columnNames.indexOf("purchasedByUserId") !== -1);
            const redeemedByFkExists = table.foreignKeys.find(fk => fk.columnNames.indexOf("redeemedByUserId") !== -1);
            
            if (!purchasedByFkExists) {
                await queryRunner.query(`
                    ALTER TABLE "gifted_subscription" 
                    ADD CONSTRAINT "FK_gifted_subscription_purchasedByUserId" 
                    FOREIGN KEY ("purchasedByUserId") REFERENCES "user"("id") 
                    ON DELETE SET NULL
                `);
            }

            if (!redeemedByFkExists) {
                await queryRunner.query(`
                    ALTER TABLE "gifted_subscription" 
                    ADD CONSTRAINT "FK_gifted_subscription_redeemedByUserId" 
                    FOREIGN KEY ("redeemedByUserId") REFERENCES "user"("id") 
                    ON DELETE SET NULL
                `);
            }
        }
    }

    async down(queryRunner) {
        // Check if table exists before attempting to drop constraints
        const tableExists = await queryRunner.hasTable("gifted_subscription");
        
        if (tableExists) {
            const table = await queryRunner.getTable("gifted_subscription");
            
            // Check if foreign keys exist before trying to drop them
            const redeemedByFk = table.foreignKeys.find(fk => fk.columnNames.indexOf("redeemedByUserId") !== -1);
            if (redeemedByFk) {
                await queryRunner.query(`ALTER TABLE "gifted_subscription" DROP CONSTRAINT "${redeemedByFk.name}"`);
            }
            
            const purchasedByFk = table.foreignKeys.find(fk => fk.columnNames.indexOf("purchasedByUserId") !== -1);
            if (purchasedByFk) {
                await queryRunner.query(`ALTER TABLE "gifted_subscription" DROP CONSTRAINT "${purchasedByFk.name}"`);
            }
        }
    }
}
