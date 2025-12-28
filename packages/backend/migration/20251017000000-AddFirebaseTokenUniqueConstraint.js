export class AddFirebaseTokenUniqueConstraint20251017000000 {
    name = 'AddFirebaseTokenUniqueConstraint20251017000000'

    async up(queryRunner) {
        // Add unique constraint to prevent same user from registering same token multiple times
        await queryRunner.query(`
            ALTER TABLE "firebase_token"
            ADD CONSTRAINT "UQ_firebase_token_user_token" UNIQUE ("userId", "token")
        `);
    }

    async down(queryRunner) {
        // Remove the unique constraint
        await queryRunner.query(`
            ALTER TABLE "firebase_token"
            DROP CONSTRAINT IF EXISTS "UQ_firebase_token_user_token"
        `);
    }
}