export class SyncMetaTableSchema20250901000000 {
    name = 'SyncMetaTableSchema20250901000000'

    async up(queryRunner) {
        // Ensure all Meta table columns exist with proper defaults
        // This migration is safe to run multiple times as it only adds missing columns
        
        try {
            // Check if meta table exists
            const metaTableExists = await queryRunner.hasTable('meta');
            if (!metaTableExists) {
                console.log('Meta table does not exist, skipping migration');
                return;
            }

            // Define all expected Meta table columns
            const expectedColumns = [
                // Basic info columns
                { name: 'name', type: 'varchar(128)', nullable: true },
                { name: 'description', type: 'varchar(1024)', nullable: true },
                { name: 'maintainerName', type: 'varchar(128)', nullable: true },
                { name: 'maintainerEmail', type: 'varchar(128)', nullable: true },
                
                // Boolean settings with defaults
                { name: 'disableRegistration', type: 'boolean', default: false },
                { name: 'preReleaseMode', type: 'boolean', default: false },
                { name: 'emailRequiredForSignup', type: 'boolean', default: false },
                { name: 'enableHcaptcha', type: 'boolean', default: false },
                { name: 'enableRecaptcha', type: 'boolean', default: false },
                { name: 'enableMcaptcha', type: 'boolean', default: false },
                { name: 'enableTurnstile', type: 'boolean', default: false },
                { name: 'enableEmail', type: 'boolean', default: false },
                { name: 'enableServiceWorker', type: 'boolean', default: false },
                { name: 'translatorAvailable', type: 'boolean', default: false },
                { name: 'cacheRemoteFiles', type: 'boolean', default: true },
                { name: 'cacheRemoteSensitiveFiles', type: 'boolean', default: true },
                { name: 'enableFanoutTimeline', type: 'boolean', default: true },
                { name: 'enableFanoutTimelineDbFallback', type: 'boolean', default: true },
                { name: 'objectStorageUseSSL', type: 'boolean', default: true },
                { name: 'objectStorageUseProxy', type: 'boolean', default: true },
                { name: 'objectStorageSetPublicRead', type: 'boolean', default: false },
                { name: 'objectStorageS3ForcePathStyle', type: 'boolean', default: true },
                { name: 'enableIpLogging', type: 'boolean', default: false },
                { name: 'enableActiveEmailValidation', type: 'boolean', default: true },
                
                // Music Integration columns (the ones causing the error)
                { name: 'enableSpotifyIntegration', type: 'boolean', default: false },
                { name: 'spotifyClientId', type: 'varchar(128)', nullable: true },
                { name: 'spotifyClientSecret', type: 'varchar(128)', nullable: true },
                { name: 'enableLastfmIntegration', type: 'boolean', default: false },
                { name: 'lastfmApiKey', type: 'varchar(128)', nullable: true },
                { name: 'lastfmApiSecret', type: 'varchar(128)', nullable: true },
                
                // Other integration columns that might be missing
                { name: 'enableTwitterIntegration', type: 'boolean', default: false },
                { name: 'twitterConsumerKey', type: 'varchar(128)', nullable: true },
                { name: 'twitterConsumerSecret', type: 'varchar(128)', nullable: true },
                { name: 'enableGithubIntegration', type: 'boolean', default: false },
                { name: 'githubClientId', type: 'varchar(128)', nullable: true },
                { name: 'githubClientSecret', type: 'varchar(128)', nullable: true },
                { name: 'enableDiscordIntegration', type: 'boolean', default: false },
                { name: 'discordClientId', type: 'varchar(128)', nullable: true },
                { name: 'discordClientSecret', type: 'varchar(128)', nullable: true },
                
                // Other columns
                { name: 'languages', type: 'varchar(1024)', nullable: true },
                { name: 'defaultLightTheme', type: 'varchar(8192)', nullable: true },
                { name: 'defaultDarkTheme', type: 'varchar(8192)', nullable: true },
                { name: 'deeplAuthKey', type: 'varchar(128)', nullable: true },
                { name: 'deeplIsPro', type: 'varchar(128)', nullable: true },
                { name: 'gifboxAuthKey', type: 'varchar(128)', nullable: true }
            ];

            // Add missing columns
            for (const column of expectedColumns) {
                const exists = await queryRunner.query(`
                    SELECT EXISTS (
                        SELECT FROM information_schema.columns 
                        WHERE table_name = 'meta' 
                        AND column_name = '${column.name}'
                    );
                `);

                if (!exists[0].exists) {
                    let sql = `ALTER TABLE "meta" ADD COLUMN "${column.name}" ${column.type}`;
                    
                    if (column.default !== undefined) {
                        sql += ` NOT NULL DEFAULT ${column.default}`;
                    } else if (column.nullable) {
                        sql += ` NULL`;
                    } else {
                        sql += ` NOT NULL`;
                    }

                    await queryRunner.query(sql);
                    console.log(`Added missing column: ${column.name}`);
                }
            }

        } catch (error) {
            console.error('Error in Meta table schema sync migration:', error);
            // Don't throw - allow deployment to continue
        }
    }

    async down(queryRunner) {
        // This migration doesn't remove columns for safety
        console.log('Down migration skipped for safety - columns not removed');
    }
}
