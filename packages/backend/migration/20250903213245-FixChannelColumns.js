export class FixChannelColumns20250903213245 {
    name = 'FixChannelColumns20250903213245'
    
    async up(queryRunner) {
        // Check if channel table exists
        const channelTableExists = await queryRunner.hasTable('channel');
        if (!channelTableExists) {
            console.log('Channel table does not exist, skipping migration');
            return;
        }

        // Check and add missing columns with correct types
        await this.addMissingChannelColumns(queryRunner);
    }
    
    async addMissingChannelColumns(queryRunner) {
        const channelColumns = [
            { name: 'moderators', type: 'jsonb', default: "'[]'::jsonb" },
            { name: 'admins', type: 'jsonb', default: "'[]'::jsonb" },
            { name: 'archive', type: 'boolean', default: 'false' },
            { name: 'banned', type: 'jsonb', default: "'[]'::jsonb" }
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
                    sql += ` NOT NULL DEFAULT ${column.default}`;
                } else {
                    sql += ` NULL`;
                }
                console.log(`Adding column ${column.name} to channel table`);
                await queryRunner.query(sql);
            } else {
                // Check if the column type is correct
                const columnInfo = await queryRunner.query(`
                    SELECT data_type, column_default 
                    FROM information_schema.columns 
                    WHERE table_name = 'channel' 
                    AND column_name = '${column.name}';
                `);
                
                if (columnInfo[0]) {
                    const currentType = columnInfo[0].data_type;
                    const expectedType = column.type === 'jsonb' ? 'jsonb' : column.type;
                    
                    // If type is wrong, drop and recreate the column
                    if (currentType !== expectedType) {
                        console.log(`Fixing column type for ${column.name}: ${currentType} -> ${expectedType}`);
                        await queryRunner.query(`ALTER TABLE "channel" DROP COLUMN "${column.name}"`);
                        let sql = `ALTER TABLE "channel" ADD COLUMN "${column.name}" ${column.type}`;
                        if (column.default !== null) {
                            sql += ` NOT NULL DEFAULT ${column.default}`;
                        } else {
                            sql += ` NULL`;
                        }
                        await queryRunner.query(sql);
                    }
                }
            }
        }
    }

    async down(queryRunner) {
        // Check if channel table exists and remove columns
        const channelTableExists = await queryRunner.hasTable('channel');
        if (channelTableExists) {
            const channelColumns = ['banned', 'archive', 'admins', 'moderators'];
            for (const columnName of channelColumns) {
                console.log(`Removing column ${columnName} from channel table`);
                await queryRunner.query(`ALTER TABLE "channel" DROP COLUMN IF EXISTS "${columnName}"`);
            }
        }
    }
}
