export class AddBrowserStreamingSupport20250716000001 {
    name = 'AddBrowserStreamingSupport20250716000001'

    async up(queryRunner) {
        // Add streamingMode column to streams table if it doesn't exist
        const streamingModeExists = await queryRunner.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.columns 
                WHERE table_name = 'streams' 
                AND column_name = 'streamingMode'
            );
        `);
        
        if (!streamingModeExists[0].exists) {
            await queryRunner.query(`
                ALTER TABLE "streams" ADD COLUMN "streamingMode" character varying(16) NOT NULL DEFAULT 'rtmp'
            `);
        }

        // Add isLive column to streams table if it doesn't exist
        const isLiveExists = await queryRunner.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.columns 
                WHERE table_name = 'streams' 
                AND column_name = 'isLive'
            );
        `);
        
        if (!isLiveExists[0].exists) {
            await queryRunner.query(`
                ALTER TABLE "streams" ADD COLUMN "isLive" boolean NOT NULL DEFAULT false
            `);
        }

        // Create index on isLive column for performance
        const isLiveIndexExists = await queryRunner.query(`
            SELECT EXISTS (
                SELECT FROM pg_class c
                JOIN pg_namespace n ON n.oid = c.relnamespace
                WHERE c.relname = 'IDX_streams_isLive'
                AND n.nspname = 'public'
            );
        `);
        
        if (!isLiveIndexExists[0].exists) {
            await queryRunner.query(`CREATE INDEX "IDX_streams_isLive" ON "streams" ("isLive")`);
        }

        // Create index on streamingMode column for performance
        const streamingModeIndexExists = await queryRunner.query(`
            SELECT EXISTS (
                SELECT FROM pg_class c
                JOIN pg_namespace n ON n.oid = c.relnamespace
                WHERE c.relname = 'IDX_streams_streamingMode'
                AND n.nspname = 'public'
            );
        `);
        
        if (!streamingModeIndexExists[0].exists) {
            await queryRunner.query(`CREATE INDEX "IDX_streams_streamingMode" ON "streams" ("streamingMode")`);
        }
    }

    async down(queryRunner) {
        // Drop indexes first
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_streams_streamingMode"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_streams_isLive"`);
        
        // Drop columns
        const streamingModeExists = await queryRunner.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.columns 
                WHERE table_name = 'streams' 
                AND column_name = 'streamingMode'
            );
        `);
        
        if (streamingModeExists[0].exists) {
            await queryRunner.query(`ALTER TABLE "streams" DROP COLUMN "streamingMode"`);
        }

        const isLiveExists = await queryRunner.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.columns 
                WHERE table_name = 'streams' 
                AND column_name = 'isLive'
            );
        `);
        
        if (isLiveExists[0].exists) {
            await queryRunner.query(`ALTER TABLE "streams" DROP COLUMN "isLive"`);
        }
    }
}
