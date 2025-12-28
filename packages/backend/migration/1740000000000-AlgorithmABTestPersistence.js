/**
 * Migration: Persistent A/B Test Configuration & User Assignments
 * 
 * CRITICAL FIX: Persist algorithm A/B test experiments and user assignments
 * to the database so they survive server reboots.
 * 
 * This fixes the issue where all A/B test configurations were lost after restart
 * because they were only stored in-memory.
 */
export class AlgorithmABTestPersistence1740000000000 {
    name = 'AlgorithmABTestPersistence1740000000000'

    async up(queryRunner) {
        // Create algorithm_experiment table
        await queryRunner.query(`
            CREATE TABLE "algorithm_experiment" (
                "id" character varying(32) NOT NULL,
                "name" character varying(255) NOT NULL,
                "description" text,
                "status" character varying(20) NOT NULL DEFAULT 'draft'
                    CHECK ("status" IN ('draft', 'active', 'paused', 'completed')),
                "startDate" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "endDate" TIMESTAMP WITH TIME ZONE,
                "trafficAllocation" numeric(3,2) NOT NULL DEFAULT 0.1
                    CHECK ("trafficAllocation" >= 0 AND "trafficAllocation" <= 1),
                "variants" jsonb NOT NULL,
                "primaryMetric" character varying(128) NOT NULL,
                "secondaryMetrics" jsonb NOT NULL DEFAULT '[]',
                "minimumSampleSize" integer NOT NULL DEFAULT 100,
                "confidenceLevel" numeric(3,2) NOT NULL DEFAULT 0.95
                    CHECK ("confidenceLevel" >= 0 AND "confidenceLevel" <= 1),
                "targetingRules" jsonb,
                "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                CONSTRAINT "PK_algorithm_experiment" PRIMARY KEY ("id")
            )
        `);

        // Create indexes for algorithm_experiment
        await queryRunner.query(`CREATE INDEX "IDX_algorithm_experiment_status" ON "algorithm_experiment" ("status")`);
        await queryRunner.query(`CREATE INDEX "IDX_algorithm_experiment_status_startDate" ON "algorithm_experiment" ("status", "startDate")`);

        // Create user_algorithm_experiment table
        await queryRunner.query(`
            CREATE TABLE "user_algorithm_experiment" (
                "id" character varying(32) NOT NULL,
                "userId" character varying(32) NOT NULL,
                "experimentId" character varying(32) NOT NULL,
                "variantId" character varying(128) NOT NULL,
                "assignedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "config" jsonb NOT NULL,
                "metrics" jsonb NOT NULL DEFAULT '{}',
                CONSTRAINT "PK_user_algorithm_experiment" PRIMARY KEY ("id"),
                CONSTRAINT "FK_user_algorithm_experiment_userId" 
                    FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE,
                CONSTRAINT "FK_user_algorithm_experiment_experimentId" 
                    FOREIGN KEY ("experimentId") REFERENCES "algorithm_experiment"("id") ON DELETE CASCADE
            )
        `);

        // Create indexes for user_algorithm_experiment
        await queryRunner.query(`CREATE INDEX "IDX_user_algorithm_experiment_userId" ON "user_algorithm_experiment" ("userId")`);
        await queryRunner.query(`CREATE INDEX "IDX_user_algorithm_experiment_experimentId" ON "user_algorithm_experiment" ("experimentId")`);
        await queryRunner.query(`CREATE INDEX "IDX_user_algorithm_experiment_experimentId_variantId" ON "user_algorithm_experiment" ("experimentId", "variantId")`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_user_algorithm_experiment_userId_experimentId" ON "user_algorithm_experiment" ("userId", "experimentId")`);
    }

    async down(queryRunner) {
        // Drop user_algorithm_experiment table and indexes
        await queryRunner.query(`DROP INDEX "IDX_user_algorithm_experiment_userId_experimentId"`);
        await queryRunner.query(`DROP INDEX "IDX_user_algorithm_experiment_experimentId_variantId"`);
        await queryRunner.query(`DROP INDEX "IDX_user_algorithm_experiment_experimentId"`);
        await queryRunner.query(`DROP INDEX "IDX_user_algorithm_experiment_userId"`);
        await queryRunner.query(`DROP TABLE "user_algorithm_experiment"`);

        // Drop algorithm_experiment table and indexes
        await queryRunner.query(`DROP INDEX "IDX_algorithm_experiment_status_startDate"`);
        await queryRunner.query(`DROP INDEX "IDX_algorithm_experiment_status"`);
        await queryRunner.query(`DROP TABLE "algorithm_experiment"`);
    }
}
