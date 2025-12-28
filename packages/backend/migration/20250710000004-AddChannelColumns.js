export class AddChannelColumns20250710000004 {
    name = 'AddChannelColumns20250710000004'
    
    async up(queryRunner) {
        // Check if channel table exists and add missing columns
        const channelTableExists = await queryRunner.hasTable('channel');
        if (channelTableExists) {
            await this.addMissingChannelColumns(queryRunner);
        }
    }
    
    async addMissingChannelColumns(queryRunner) {
        const channelColumns = [
            { name: 'moderators', type: 'varchar(32)[]', default: "'{}'" },
            { name: 'admins', type: 'varchar(32)[]', default: "'{}'" },
            { name: 'archive', type: 'boolean', default: 'false' },
            { name: 'banned', type: 'boolean', default: 'false' }
        ];
        
        for (const column of channelColumns) {
            const exists = await queryRunner.query(`
                SELECT EXISTS (
                    SELECT FROM information_schema.columns 
                    WHERE table_name = 'channel' 
                    AND column_name = '${column.name}'
                );
            `);
            
            if (!exists[0].exists) {
                let sql = `ALTER TABLE "channel" ADD COLUMN "${column.name}" ${column.type}`;
                if (column.default !== null) {
                    if (column.type === 'boolean') {
                        sql += ` NOT NULL DEFAULT ${column.default}`;
                    } else if (column.type.includes('[]')) {
                        sql += ` NOT NULL DEFAULT ${column.default}`;
                    } else {
                        sql += ` NULL`;
                    }
                } else {
                    sql += ` NULL`;
                }
                await queryRunner.query(sql);
            }
        }
    }

    async down(queryRunner) {
        // Check if channel table exists and remove columns
        const channelTableExists = await queryRunner.hasTable('channel');
        if (channelTableExists) {
            const channelColumns = ['banned', 'archive', 'admins', 'moderators'];
            for (const columnName of channelColumns) {
                await queryRunner.query(`ALTER TABLE "channel" DROP COLUMN IF EXISTS "${columnName}"`);
            }
        }
    }
}
