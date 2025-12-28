export class CreateContactImportTable20250903000000 {
    name = 'CreateContactImportTable20250903000000'
    
    async up(queryRunner) {
        // Create contact_import table
        await queryRunner.query(`
            CREATE TABLE "contact_import" (
                "id" VARCHAR(32) NOT NULL,
                "userId" VARCHAR(32) NOT NULL,
                "hashedContact" VARCHAR(64) NOT NULL,
                "contactName" VARCHAR(255),
                "isMatched" BOOLEAN NOT NULL DEFAULT FALSE,
                "matchedUserId" VARCHAR(32),
                "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
                
                CONSTRAINT "PK_contact_import" PRIMARY KEY ("id"),
                CONSTRAINT "FK_contact_import_user" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE,
                CONSTRAINT "FK_contact_import_matched_user" FOREIGN KEY ("matchedUserId") REFERENCES "user"("id") ON DELETE SET NULL
            )
        `);
        
        // Create indexes for performance
        await queryRunner.query(`CREATE INDEX "IDX_contact_import_userId" ON "contact_import" ("userId")`);
        await queryRunner.query(`CREATE INDEX "IDX_contact_import_hashedContact" ON "contact_import" ("hashedContact")`);
        await queryRunner.query(`CREATE INDEX "IDX_contact_import_matchedUserId" ON "contact_import" ("matchedUserId")`);
        
        // Create unique constraint to prevent duplicate contacts per user
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_contact_import_user_contact" ON "contact_import" ("userId", "hashedContact")`);
        
        // Add column comments
        await queryRunner.query(`COMMENT ON COLUMN "contact_import"."id" IS 'The unique identifier for the contact import record.'`);
        await queryRunner.query(`COMMENT ON COLUMN "contact_import"."userId" IS 'The ID of the user who imported this contact.'`);
        await queryRunner.query(`COMMENT ON COLUMN "contact_import"."hashedContact" IS 'SHA-256 hash of the contact identifier (phone/email) for privacy.'`);
        await queryRunner.query(`COMMENT ON COLUMN "contact_import"."contactName" IS 'The display name of the contact.'`);
        await queryRunner.query(`COMMENT ON COLUMN "contact_import"."isMatched" IS 'Whether this contact has been matched to a Barkle user.'`);
        await queryRunner.query(`COMMENT ON COLUMN "contact_import"."matchedUserId" IS 'The ID of the matched Barkle user, if any.'`);
        await queryRunner.query(`COMMENT ON COLUMN "contact_import"."createdAt" IS 'The timestamp when this contact was imported.'`);
    }

    async down(queryRunner) {
        // Drop the table (indexes and constraints will be dropped automatically)
        await queryRunner.query(`DROP TABLE IF EXISTS "contact_import"`);
    }
}
