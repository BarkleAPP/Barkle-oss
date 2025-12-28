export class AddReminderNotificationSettings1730577600000 {
    constructor() {
        this.name = 'AddReminderNotificationSettings1730577600000';
    }

    async up(queryRunner) {
        // Add social reminders enabled flag to user_profile
        await queryRunner.query(`
            ALTER TABLE "user_profile" 
            ADD COLUMN IF NOT EXISTS "receiveSocialReminders" boolean NOT NULL DEFAULT true
        `);

        // Add email reminders flag to user_profile
        await queryRunner.query(`
            ALTER TABLE "user_profile" 
            ADD COLUMN IF NOT EXISTS "receiveEmailReminders" boolean NOT NULL DEFAULT true
        `);

        // Update emailNotificationTypes to include socialReminder
        await queryRunner.query(`
            UPDATE "user_profile"
            SET "emailNotificationTypes" = 
                CASE 
                    WHEN "emailNotificationTypes" @> '["socialReminder"]'::jsonb 
                    THEN "emailNotificationTypes"
                    ELSE "emailNotificationTypes" || '["socialReminder"]'::jsonb
                END
            WHERE "receiveEmailReminders" = true
        `);
    }

    async down(queryRunner) {
        // Remove social reminder from emailNotificationTypes
        await queryRunner.query(`
            UPDATE "user_profile"
            SET "emailNotificationTypes" = (
                SELECT jsonb_agg(elem)
                FROM jsonb_array_elements("emailNotificationTypes") elem
                WHERE elem::text != '"socialReminder"'
            )
            WHERE "emailNotificationTypes" @> '["socialReminder"]'::jsonb
        `);

        // Remove columns
        await queryRunner.query(`ALTER TABLE "user_profile" DROP COLUMN IF EXISTS "receiveEmailReminders"`);
        await queryRunner.query(`ALTER TABLE "user_profile" DROP COLUMN IF EXISTS "receiveSocialReminders"`);
    }
}
