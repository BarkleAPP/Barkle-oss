/**
 * Migration: Firebase Cloud Messaging Configuration
 * 
 * Adds Firebase FCM configuration fields to meta table
 * for push notification support in native apps
 */
export class FirebaseConfiguration1740000200000 {
    name = 'FirebaseConfiguration1740000200000'

    async up(queryRunner) {
        // Add Firebase configuration columns to meta table
        await queryRunner.query(`
            ALTER TABLE "meta"
            ADD COLUMN IF NOT EXISTS "enableFirebaseMessaging" boolean DEFAULT FALSE,
            ADD COLUMN IF NOT EXISTS "firebaseVapidPublicKey" varchar(256),
            ADD COLUMN IF NOT EXISTS "firebaseApiKey" varchar(128),
            ADD COLUMN IF NOT EXISTS "firebaseAuthDomain" varchar(256),
            ADD COLUMN IF NOT EXISTS "firebaseProjectId" varchar(128),
            ADD COLUMN IF NOT EXISTS "firebaseStorageBucket" varchar(256),
            ADD COLUMN IF NOT EXISTS "firebaseMessagingSenderId" varchar(128),
            ADD COLUMN IF NOT EXISTS "firebaseAppId" varchar(256),
            ADD COLUMN IF NOT EXISTS "firebaseServiceAccountJson" text
        `);
    }

    async down(queryRunner) {
        // Remove Firebase configuration columns
        await queryRunner.query(`
            ALTER TABLE "meta"
            DROP COLUMN IF EXISTS "firebaseServiceAccountJson",
            DROP COLUMN IF EXISTS "firebaseAppId",
            DROP COLUMN IF EXISTS "firebaseMessagingSenderId",
            DROP COLUMN IF EXISTS "firebaseStorageBucket",
            DROP COLUMN IF EXISTS "firebaseProjectId",
            DROP COLUMN IF EXISTS "firebaseAuthDomain",
            DROP COLUMN IF EXISTS "firebaseApiKey",
            DROP COLUMN IF NOT EXISTS "firebaseVapidPublicKey",
            DROP COLUMN IF EXISTS "enableFirebaseMessaging"
        `);
    }
}
