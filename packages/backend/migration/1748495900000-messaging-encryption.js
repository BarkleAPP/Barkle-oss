export class messagingEncryption1748495900000 {
    name = 'messagingEncryption1748495900000'

    async up(queryRunner) {
        // Add encryption-related columns to messaging_message table
        await queryRunner.query(`
            ALTER TABLE "messaging_message" 
            ADD COLUMN "encryptedText" text NULL
        `);

        await queryRunner.query(`
            ALTER TABLE "messaging_message" 
            ADD COLUMN "encryptionVersion" varchar(10) NULL
        `);

        await queryRunner.query(`
            ALTER TABLE "messaging_message" 
            ADD COLUMN "encryptionAlgorithm" varchar(50) NULL
        `);

        await queryRunner.query(`
            ALTER TABLE "messaging_message" 
            ADD COLUMN "encryptionKeyId" varchar(64) NULL
        `);

        await queryRunner.query(`
            ALTER TABLE "messaging_message" 
            ADD COLUMN "encryptionIv" varchar(32) NULL
        `);

        await queryRunner.query(`
            ALTER TABLE "messaging_message" 
            ADD COLUMN "encryptionSalt" varchar(32) NULL
        `);

        await queryRunner.query(`
            ALTER TABLE "messaging_message" 
            ADD COLUMN "isEncrypted" boolean NOT NULL DEFAULT false
        `);

        // Create indexes for encryption fields
        await queryRunner.query(`
            CREATE INDEX "IDX_messaging_message_isEncrypted" 
            ON "messaging_message" ("isEncrypted")
        `);

        await queryRunner.query(`
            CREATE INDEX "IDX_messaging_message_encryptionKeyId" 
            ON "messaging_message" ("encryptionKeyId")
        `);

        // Create user encryption keys table for storing user's public/private key pairs
        await queryRunner.query(`
            CREATE TABLE "user_encryption_key" (
                "id" varchar NOT NULL,
                "userId" varchar NOT NULL,
                "publicKey" text NOT NULL,
                "privateKeyEncrypted" text NOT NULL,
                "algorithm" varchar(50) NOT NULL DEFAULT 'rsa-oaep',
                "keySize" integer NOT NULL DEFAULT 2048,
                "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "isActive" boolean NOT NULL DEFAULT true,
                "version" varchar(10) NOT NULL DEFAULT '1.0',
                CONSTRAINT "PK_user_encryption_key" PRIMARY KEY ("id"),
                CONSTRAINT "UQ_user_encryption_key_userId_active" UNIQUE ("userId", "isActive")
            )
        `);

        await queryRunner.query(`
            ALTER TABLE "user_encryption_key" 
            ADD CONSTRAINT "FK_user_encryption_key_userId" 
            FOREIGN KEY ("userId") REFERENCES "user"("id") 
            ON DELETE CASCADE
        `);

        await queryRunner.query(`
            CREATE INDEX "IDX_user_encryption_key_userId" 
            ON "user_encryption_key" ("userId")
        `);

        await queryRunner.query(`
            CREATE INDEX "IDX_user_encryption_key_isActive" 
            ON "user_encryption_key" ("isActive")
        `);

        // Create message encryption keys table for storing per-message symmetric keys
        await queryRunner.query(`
            CREATE TABLE "message_encryption_key" (
                "id" varchar NOT NULL,
                "messageId" varchar NOT NULL,
                "userId" varchar NOT NULL,
                "encryptedKey" text NOT NULL,
                "algorithm" varchar(50) NOT NULL DEFAULT 'aes-256-gcm',
                "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                CONSTRAINT "PK_message_encryption_key" PRIMARY KEY ("id"),
                CONSTRAINT "UQ_message_encryption_key_messageId_userId" UNIQUE ("messageId", "userId")
            )
        `);

        await queryRunner.query(`
            ALTER TABLE "message_encryption_key" 
            ADD CONSTRAINT "FK_message_encryption_key_messageId" 
            FOREIGN KEY ("messageId") REFERENCES "messaging_message"("id") 
            ON DELETE CASCADE
        `);

        await queryRunner.query(`
            ALTER TABLE "message_encryption_key" 
            ADD CONSTRAINT "FK_message_encryption_key_userId" 
            FOREIGN KEY ("userId") REFERENCES "user"("id") 
            ON DELETE CASCADE
        `);

        await queryRunner.query(`
            CREATE INDEX "IDX_message_encryption_key_messageId" 
            ON "message_encryption_key" ("messageId")
        `);

        await queryRunner.query(`
            CREATE INDEX "IDX_message_encryption_key_userId" 
            ON "message_encryption_key" ("userId")
        `);

        // Create encryption preferences table for user settings
        await queryRunner.query(`
            CREATE TABLE "user_encryption_preference" (
                "userId" varchar NOT NULL,
                "encryptByDefault" boolean NOT NULL DEFAULT false,
                "allowLegacyMessages" boolean NOT NULL DEFAULT true,
                "keyRotationDays" integer NOT NULL DEFAULT 365,
                "lastKeyRotation" TIMESTAMP WITH TIME ZONE,
                "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                CONSTRAINT "PK_user_encryption_preference" PRIMARY KEY ("userId")
            )
        `);

        await queryRunner.query(`
            ALTER TABLE "user_encryption_preference" 
            ADD CONSTRAINT "FK_user_encryption_preference_userId" 
            FOREIGN KEY ("userId") REFERENCES "user"("id") 
            ON DELETE CASCADE
        `);
    }

    async down(queryRunner) {
        // Drop tables in reverse order
        await queryRunner.query(`DROP TABLE "user_encryption_preference"`);
        await queryRunner.query(`DROP TABLE "message_encryption_key"`);
        await queryRunner.query(`DROP TABLE "user_encryption_key"`);

        // Drop indexes
        await queryRunner.query(`DROP INDEX "IDX_messaging_message_encryptionKeyId"`);
        await queryRunner.query(`DROP INDEX "IDX_messaging_message_isEncrypted"`);

        // Drop columns from messaging_message table
        await queryRunner.query(`ALTER TABLE "messaging_message" DROP COLUMN "isEncrypted"`);
        await queryRunner.query(`ALTER TABLE "messaging_message" DROP COLUMN "encryptionSalt"`);
        await queryRunner.query(`ALTER TABLE "messaging_message" DROP COLUMN "encryptionIv"`);
        await queryRunner.query(`ALTER TABLE "messaging_message" DROP COLUMN "encryptionKeyId"`);
        await queryRunner.query(`ALTER TABLE "messaging_message" DROP COLUMN "encryptionAlgorithm"`);
        await queryRunner.query(`ALTER TABLE "messaging_message" DROP COLUMN "encryptionVersion"`);
        await queryRunner.query(`ALTER TABLE "messaging_message" DROP COLUMN "encryptedText"`);
    }
}
