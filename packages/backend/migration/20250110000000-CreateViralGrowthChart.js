export class CreateViralGrowthChart1704844800000 {
    name = 'CreateViralGrowthChart1704844800000'

    async up(queryRunner) {
        // Create viral growth chart tables (hour and day)
        await queryRunner.query(`
            CREATE TABLE "__chart__viral_growth" (
                "id" SERIAL NOT NULL,
                "date" integer NOT NULL,
                "group" character varying(128),
                "___follows_total" smallint NOT NULL DEFAULT '0',
                "___follows_fromInvitation" smallint NOT NULL DEFAULT '0',
                "___follows_organic" smallint NOT NULL DEFAULT '0',
                "___invitations_sent" smallint NOT NULL DEFAULT '0',
                "___invitations_accepted" smallint NOT NULL DEFAULT '0',
                "___invitations_newUserSignups" smallint NOT NULL DEFAULT '0',
                "___viralCoefficient_completedLoops" smallint NOT NULL DEFAULT '0',
                "___viralCoefficient_newUsersFromInvitations" smallint NOT NULL DEFAULT '0',
                "___viralCoefficient_chainReactions" smallint NOT NULL DEFAULT '0',
                "___viralMoments_total" smallint NOT NULL DEFAULT '0',
                "___viralMoments_rapid_growth" smallint NOT NULL DEFAULT '0',
                "___viralMoments_network_effect" smallint NOT NULL DEFAULT '0',
                "___viralMoments_milestone_reached" smallint NOT NULL DEFAULT '0',
                "___viralMoments_viral_content" smallint NOT NULL DEFAULT '0',
                "___highAmplification_total" smallint NOT NULL DEFAULT '0',
                "___highAmplification_rapid_growth" smallint NOT NULL DEFAULT '0',
                "___highAmplification_network_effect" smallint NOT NULL DEFAULT '0',
                "___highAmplification_milestone_reached" smallint NOT NULL DEFAULT '0',
                "___networkExpansion_total" smallint NOT NULL DEFAULT '0',
                "___networkExpansion_suggestions" smallint NOT NULL DEFAULT '0',
                "___recommendationBoosts_total" smallint NOT NULL DEFAULT '0',
                "___momentum_highScoreUsers" smallint NOT NULL DEFAULT '0',
                "___momentum_averageScore" smallint NOT NULL DEFAULT '0',
                "___contentAmplification_total" smallint NOT NULL DEFAULT '0',
                "___contentAmplification_low" smallint NOT NULL DEFAULT '0',
                "___contentAmplification_medium" smallint NOT NULL DEFAULT '0',
                "___contentAmplification_high" smallint NOT NULL DEFAULT '0',
                "___contentAmplification_viral" smallint NOT NULL DEFAULT '0',
                "___contentAmplification_engagementScore" smallint NOT NULL DEFAULT '0',
                "___viralAmplification_total" smallint NOT NULL DEFAULT '0',
                "___viralAmplification_contentBoosts" smallint NOT NULL DEFAULT '0',
                "___creatorBoosts_total" smallint NOT NULL DEFAULT '0',
                "___creatorBoosts_duration" smallint NOT NULL DEFAULT '0',
                "___milestoneRecognition_total" smallint NOT NULL DEFAULT '0',
                "___milestoneRecognition_user_milestone" smallint NOT NULL DEFAULT '0',
                "___milestoneRecognition_content_milestone" smallint NOT NULL DEFAULT '0',
                "___milestoneRecognition_network_milestone" smallint NOT NULL DEFAULT '0',
                "___milestoneRecognition_bronze" smallint NOT NULL DEFAULT '0',
                "___milestoneRecognition_silver" smallint NOT NULL DEFAULT '0',
                "___milestoneRecognition_gold" smallint NOT NULL DEFAULT '0',
                "___milestoneRecognition_platinum" smallint NOT NULL DEFAULT '0',
                CONSTRAINT "PK_viral_growth_chart" PRIMARY KEY ("id")
            )
        `);

        await queryRunner.query(`
            CREATE TABLE "__chart_day__viral_growth" (
                "id" SERIAL NOT NULL,
                "date" integer NOT NULL,
                "group" character varying(128),
                "___follows_total" smallint NOT NULL DEFAULT '0',
                "___follows_fromInvitation" smallint NOT NULL DEFAULT '0',
                "___follows_organic" smallint NOT NULL DEFAULT '0',
                "___invitations_sent" smallint NOT NULL DEFAULT '0',
                "___invitations_accepted" smallint NOT NULL DEFAULT '0',
                "___invitations_newUserSignups" smallint NOT NULL DEFAULT '0',
                "___viralCoefficient_completedLoops" smallint NOT NULL DEFAULT '0',
                "___viralCoefficient_newUsersFromInvitations" smallint NOT NULL DEFAULT '0',
                "___viralCoefficient_chainReactions" smallint NOT NULL DEFAULT '0',
                "___viralMoments_total" smallint NOT NULL DEFAULT '0',
                "___viralMoments_rapid_growth" smallint NOT NULL DEFAULT '0',
                "___viralMoments_network_effect" smallint NOT NULL DEFAULT '0',
                "___viralMoments_milestone_reached" smallint NOT NULL DEFAULT '0',
                "___viralMoments_viral_content" smallint NOT NULL DEFAULT '0',
                "___highAmplification_total" smallint NOT NULL DEFAULT '0',
                "___highAmplification_rapid_growth" smallint NOT NULL DEFAULT '0',
                "___highAmplification_network_effect" smallint NOT NULL DEFAULT '0',
                "___highAmplification_milestone_reached" smallint NOT NULL DEFAULT '0',
                "___networkExpansion_total" smallint NOT NULL DEFAULT '0',
                "___networkExpansion_suggestions" smallint NOT NULL DEFAULT '0',
                "___recommendationBoosts_total" smallint NOT NULL DEFAULT '0',
                "___momentum_highScoreUsers" smallint NOT NULL DEFAULT '0',
                "___momentum_averageScore" smallint NOT NULL DEFAULT '0',
                "___contentAmplification_total" smallint NOT NULL DEFAULT '0',
                "___contentAmplification_low" smallint NOT NULL DEFAULT '0',
                "___contentAmplification_medium" smallint NOT NULL DEFAULT '0',
                "___contentAmplification_high" smallint NOT NULL DEFAULT '0',
                "___contentAmplification_viral" smallint NOT NULL DEFAULT '0',
                "___contentAmplification_engagementScore" smallint NOT NULL DEFAULT '0',
                "___viralAmplification_total" smallint NOT NULL DEFAULT '0',
                "___viralAmplification_contentBoosts" smallint NOT NULL DEFAULT '0',
                "___creatorBoosts_total" smallint NOT NULL DEFAULT '0',
                "___creatorBoosts_duration" smallint NOT NULL DEFAULT '0',
                "___milestoneRecognition_total" smallint NOT NULL DEFAULT '0',
                "___milestoneRecognition_user_milestone" smallint NOT NULL DEFAULT '0',
                "___milestoneRecognition_content_milestone" smallint NOT NULL DEFAULT '0',
                "___milestoneRecognition_network_milestone" smallint NOT NULL DEFAULT '0',
                "___milestoneRecognition_bronze" smallint NOT NULL DEFAULT '0',
                "___milestoneRecognition_silver" smallint NOT NULL DEFAULT '0',
                "___milestoneRecognition_gold" smallint NOT NULL DEFAULT '0',
                "___milestoneRecognition_platinum" smallint NOT NULL DEFAULT '0',
                CONSTRAINT "PK_viral_growth_chart_day" PRIMARY KEY ("id")
            )
        `);

        // Create unique indexes for date and group
        await queryRunner.query(`
            CREATE UNIQUE INDEX "IDX_viral_growth_chart_date" ON "__chart__viral_growth" ("date")
        `);

        await queryRunner.query(`
            CREATE UNIQUE INDEX "IDX_viral_growth_chart_day_date" ON "__chart_day__viral_growth" ("date")
        `);

        // Create indexes for grouped charts if needed
        await queryRunner.query(`
            CREATE INDEX "IDX_viral_growth_chart_date_group" ON "__chart__viral_growth" ("date", "group")
        `);

        await queryRunner.query(`
            CREATE INDEX "IDX_viral_growth_chart_day_date_group" ON "__chart_day__viral_growth" ("date", "group")
        `);
    }

    async down(queryRunner) {
        await queryRunner.query(`DROP INDEX "IDX_viral_growth_chart_day_date_group"`);
        await queryRunner.query(`DROP INDEX "IDX_viral_growth_chart_date_group"`);
        await queryRunner.query(`DROP INDEX "IDX_viral_growth_chart_day_date"`);
        await queryRunner.query(`DROP INDEX "IDX_viral_growth_chart_date"`);
        await queryRunner.query(`DROP TABLE "__chart_day__viral_growth"`);
        await queryRunner.query(`DROP TABLE "__chart__viral_growth"`);
    }
}