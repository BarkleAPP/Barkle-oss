export class AddAlgorithmTables1734364800000 {
    name = 'AddAlgorithmTables1734364800000'

    async up(queryRunner) {
        // Create user_behavioral_data table
        await queryRunner.query(`
            CREATE TABLE "user_behavioral_data" (
                "id" character varying(32) NOT NULL,
                "userId" character varying(32) NOT NULL,
                "contentId" character varying(32) NOT NULL,
                "interactionType" character varying(32) NOT NULL,
                "reactionType" character varying(32),
                "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL,
                "duration" integer,
                "context" jsonb NOT NULL DEFAULT '{}',
                "engagementScore" numeric(5,4) NOT NULL DEFAULT '0',
                "processed" boolean NOT NULL DEFAULT false,
                CONSTRAINT "PK_user_behavioral_data" PRIMARY KEY ("id")
            )
        `);

        // Create indexes for user_behavioral_data
        await queryRunner.query(`CREATE INDEX "IDX_user_behavioral_data_userId_createdAt" ON "user_behavioral_data" ("userId", "createdAt")`);
        await queryRunner.query(`CREATE INDEX "IDX_user_behavioral_data_contentId_interactionType" ON "user_behavioral_data" ("contentId", "interactionType")`);
        await queryRunner.query(`CREATE INDEX "IDX_user_behavioral_data_userId" ON "user_behavioral_data" ("userId")`);
        await queryRunner.query(`CREATE INDEX "IDX_user_behavioral_data_contentId" ON "user_behavioral_data" ("contentId")`);
        await queryRunner.query(`CREATE INDEX "IDX_user_behavioral_data_interactionType" ON "user_behavioral_data" ("interactionType")`);
        await queryRunner.query(`CREATE INDEX "IDX_user_behavioral_data_createdAt" ON "user_behavioral_data" ("createdAt")`);

        // Create user_algorithm_profile table
        await queryRunner.query(`
            CREATE TABLE "user_algorithm_profile" (
                "userId" character varying(32) NOT NULL,
                "embedding" jsonb NOT NULL DEFAULT '[]',
                "interestCategories" jsonb NOT NULL DEFAULT '{}',
                "avgDwellTime" numeric(8,2) NOT NULL DEFAULT '0',
                "preferredContentTypes" jsonb NOT NULL DEFAULT '[]',
                "activeTimeWindows" jsonb NOT NULL DEFAULT '[]',
                "socialInfluence" numeric(3,2) NOT NULL DEFAULT '0.5',
                "diversityPreference" numeric(3,2) NOT NULL DEFAULT '0.2',
                "lastUpdated" TIMESTAMP WITH TIME ZONE NOT NULL,
                "totalInteractions" integer NOT NULL DEFAULT '0',
                "engagementRate" numeric(5,4) NOT NULL DEFAULT '0',
                "recentInteractions" jsonb NOT NULL DEFAULT '[]',
                "algorithmVersion" character varying(32) NOT NULL DEFAULT '1.0',
                "personalizationEnabled" boolean NOT NULL DEFAULT true,
                CONSTRAINT "PK_user_algorithm_profile" PRIMARY KEY ("userId")
            )
        `);

        // Create index for user_algorithm_profile
        await queryRunner.query(`CREATE INDEX "IDX_user_algorithm_profile_lastUpdated" ON "user_algorithm_profile" ("lastUpdated")`);

        // Create content_algorithm_features table
        await queryRunner.query(`
            CREATE TABLE "content_algorithm_features" (
                "contentId" character varying(32) NOT NULL,
                "authorId" character varying(32) NOT NULL,
                "embedding" jsonb NOT NULL DEFAULT '[]',
                "topics" jsonb NOT NULL DEFAULT '[]',
                "language" character varying(10) NOT NULL DEFAULT 'en',
                "contentType" character varying(32) NOT NULL,
                "hasMedia" boolean NOT NULL DEFAULT false,
                "textLength" integer,
                "mediaCount" integer NOT NULL DEFAULT '0',
                "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL,
                "reactions" integer NOT NULL DEFAULT '0',
                "shares" integer NOT NULL DEFAULT '0',
                "comments" integer NOT NULL DEFAULT '0',
                "views" integer NOT NULL DEFAULT '0',
                "renotes" integer NOT NULL DEFAULT '0',
                "engagementRate" numeric(5,4) NOT NULL DEFAULT '0',
                "viralityScore" numeric(5,4) NOT NULL DEFAULT '0',
                "freshness" numeric(3,2) NOT NULL DEFAULT '1.0',
                "qualityScore" numeric(3,2) NOT NULL DEFAULT '0.5',
                "lastUpdated" TIMESTAMP WITH TIME ZONE NOT NULL,
                "algorithmVersion" character varying(32) NOT NULL DEFAULT '1.0',
                "embeddingComputed" boolean NOT NULL DEFAULT false,
                CONSTRAINT "PK_content_algorithm_features" PRIMARY KEY ("contentId")
            )
        `);

        // Create indexes for content_algorithm_features
        await queryRunner.query(`CREATE INDEX "IDX_content_algorithm_features_createdAt_viralityScore" ON "content_algorithm_features" ("createdAt", "viralityScore")`);
        await queryRunner.query(`CREATE INDEX "IDX_content_algorithm_features_authorId_engagementRate" ON "content_algorithm_features" ("authorId", "engagementRate")`);
        await queryRunner.query(`CREATE INDEX "IDX_content_algorithm_features_authorId" ON "content_algorithm_features" ("authorId")`);
        await queryRunner.query(`CREATE INDEX "IDX_content_algorithm_features_createdAt" ON "content_algorithm_features" ("createdAt")`);
        await queryRunner.query(`CREATE INDEX "IDX_content_algorithm_features_engagementRate" ON "content_algorithm_features" ("engagementRate")`);
        await queryRunner.query(`CREATE INDEX "IDX_content_algorithm_features_viralityScore" ON "content_algorithm_features" ("viralityScore")`);

        // Create timeline_cache table
        await queryRunner.query(`
            CREATE TABLE "timeline_cache" (
                "id" character varying(32) NOT NULL,
                "userId" character varying(32) NOT NULL,
                "content" jsonb NOT NULL,
                "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL,
                "cursor" character varying(128) NOT NULL,
                "ttl" integer NOT NULL DEFAULT '3600',
                "version" character varying(64) NOT NULL,
                "algorithmVersion" character varying(32) NOT NULL DEFAULT '1.0',
                "batchSize" integer NOT NULL DEFAULT '20',
                "hasMore" boolean NOT NULL DEFAULT true,
                "metadata" jsonb NOT NULL DEFAULT '{}',
                CONSTRAINT "PK_timeline_cache" PRIMARY KEY ("id")
            )
        `);

        // Create indexes for timeline_cache
        await queryRunner.query(`CREATE INDEX "IDX_timeline_cache_userId_createdAt" ON "timeline_cache" ("userId", "createdAt")`);
        await queryRunner.query(`CREATE INDEX "IDX_timeline_cache_userId_cursor" ON "timeline_cache" ("userId", "cursor")`);
        await queryRunner.query(`CREATE INDEX "IDX_timeline_cache_userId" ON "timeline_cache" ("userId")`);
        await queryRunner.query(`CREATE INDEX "IDX_timeline_cache_createdAt" ON "timeline_cache" ("createdAt")`);
        await queryRunner.query(`CREATE INDEX "IDX_timeline_cache_cursor" ON "timeline_cache" ("cursor")`);

        // Add foreign key constraints
        await queryRunner.query(`ALTER TABLE "user_behavioral_data" ADD CONSTRAINT "FK_user_behavioral_data_userId" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "user_behavioral_data" ADD CONSTRAINT "FK_user_behavioral_data_contentId" FOREIGN KEY ("contentId") REFERENCES "note"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "user_algorithm_profile" ADD CONSTRAINT "FK_user_algorithm_profile_userId" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "content_algorithm_features" ADD CONSTRAINT "FK_content_algorithm_features_contentId" FOREIGN KEY ("contentId") REFERENCES "note"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "content_algorithm_features" ADD CONSTRAINT "FK_content_algorithm_features_authorId" FOREIGN KEY ("authorId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "timeline_cache" ADD CONSTRAINT "FK_timeline_cache_userId" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    async down(queryRunner) {
        // Drop foreign key constraints
        await queryRunner.query(`ALTER TABLE "timeline_cache" DROP CONSTRAINT "FK_timeline_cache_userId"`);
        await queryRunner.query(`ALTER TABLE "content_algorithm_features" DROP CONSTRAINT "FK_content_algorithm_features_authorId"`);
        await queryRunner.query(`ALTER TABLE "content_algorithm_features" DROP CONSTRAINT "FK_content_algorithm_features_contentId"`);
        await queryRunner.query(`ALTER TABLE "user_algorithm_profile" DROP CONSTRAINT "FK_user_algorithm_profile_userId"`);
        await queryRunner.query(`ALTER TABLE "user_behavioral_data" DROP CONSTRAINT "FK_user_behavioral_data_contentId"`);
        await queryRunner.query(`ALTER TABLE "user_behavioral_data" DROP CONSTRAINT "FK_user_behavioral_data_userId"`);

        // Drop tables
        await queryRunner.query(`DROP TABLE "timeline_cache"`);
        await queryRunner.query(`DROP TABLE "content_algorithm_features"`);
        await queryRunner.query(`DROP TABLE "user_algorithm_profile"`);
        await queryRunner.query(`DROP TABLE "user_behavioral_data"`);
    }
}