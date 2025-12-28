export class FixLiveChatMessageStreamIdLength20250715000001 {
	async up(queryRunner) {
		// Fix the streamId column length in live_chat_message table to match streams.id
		await queryRunner.query(`
			DO $$ 
			BEGIN 
				-- Check if live_chat_message table exists
				IF EXISTS (
					SELECT FROM information_schema.tables 
					WHERE table_name = 'live_chat_message'
				) THEN 
					-- Check current column length
					IF EXISTS (
						SELECT FROM information_schema.columns 
						WHERE table_name = 'live_chat_message' 
						AND column_name = 'streamId'
						AND character_maximum_length = 32
					) THEN
						-- Drop the foreign key constraint temporarily
						ALTER TABLE "live_chat_message" DROP CONSTRAINT IF EXISTS "FK_live_chat_message_streamId";
						
						-- Update the column length to 128 to match streams.id
						ALTER TABLE "live_chat_message" ALTER COLUMN "streamId" TYPE character varying(128);
						
						-- Re-add the foreign key constraint
						ALTER TABLE "live_chat_message" ADD CONSTRAINT "FK_live_chat_message_streamId" 
							FOREIGN KEY ("streamId") REFERENCES "streams"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
					END IF;
				END IF;
			END $$;
		`);
	}

	async down(queryRunner) {
		// Revert the streamId column length back to 32 (note: this might fail if there are existing long stream IDs)
		await queryRunner.query(`
			DO $$ 
			BEGIN 
				-- Check if live_chat_message table exists
				IF EXISTS (
					SELECT FROM information_schema.tables 
					WHERE table_name = 'live_chat_message'
				) THEN 
					-- Check current column length
					IF EXISTS (
						SELECT FROM information_schema.columns 
						WHERE table_name = 'live_chat_message' 
						AND column_name = 'streamId'
						AND character_maximum_length = 128
					) THEN
						-- Drop the foreign key constraint temporarily
						ALTER TABLE "live_chat_message" DROP CONSTRAINT IF EXISTS "FK_live_chat_message_streamId";
						
						-- Update the column length back to 32 (this might fail if data doesn't fit)
						ALTER TABLE "live_chat_message" ALTER COLUMN "streamId" TYPE character varying(32);
						
						-- Re-add the foreign key constraint
						ALTER TABLE "live_chat_message" ADD CONSTRAINT "FK_live_chat_message_streamId" 
							FOREIGN KEY ("streamId") REFERENCES "streams"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
					END IF;
				END IF;
			END $$;
		`);
	}
}
