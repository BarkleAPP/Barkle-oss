export class UpdateStreamsIdLength1673515200001 {
	async up(queryRunner) {
		// Update the streams table id column to allow longer IDs for Mux live stream IDs
		await queryRunner.query(`
			DO $$ 
			BEGIN 
				IF EXISTS (
					SELECT FROM information_schema.columns 
					WHERE table_name = 'streams' AND column_name = 'id'
				) THEN 
					-- Check if live_chat_message table exists before modifying it
					IF EXISTS (
						SELECT FROM information_schema.tables 
						WHERE table_name = 'live_chat_message'
					) THEN
						-- First, drop dependent foreign key constraints
						ALTER TABLE "live_chat_message" DROP CONSTRAINT IF EXISTS "FK_live_chat_message_streamId";
					END IF;
					
					-- Drop the existing primary key constraint
					ALTER TABLE "streams" DROP CONSTRAINT IF EXISTS "PK_stream_id";
					
					-- Modify the column to be longer (128 characters to accommodate Mux IDs)
					ALTER TABLE "streams" ALTER COLUMN "id" TYPE character varying(128);
					
					-- Also update the live_chat_message.streamId column to match if table exists
					IF EXISTS (
						SELECT FROM information_schema.tables 
						WHERE table_name = 'live_chat_message'
					) THEN
						ALTER TABLE "live_chat_message" ALTER COLUMN "streamId" TYPE character varying(128);
					END IF;
					
					-- Re-add the primary key constraint
					ALTER TABLE "streams" ADD CONSTRAINT "PK_stream_id" PRIMARY KEY ("id");
					
					-- Re-add the foreign key constraint if live_chat_message table exists
					IF EXISTS (
						SELECT FROM information_schema.tables 
						WHERE table_name = 'live_chat_message'
					) THEN
						ALTER TABLE "live_chat_message" ADD CONSTRAINT "FK_live_chat_message_streamId" 
							FOREIGN KEY ("streamId") REFERENCES "streams"("id") ON DELETE CASCADE;
					END IF;
				END IF;
			END $$;
		`);
	}

	async down(queryRunner) {
		// Revert the streams table id column back to 32 characters
		await queryRunner.query(`
			DO $$ 
			BEGIN 
				IF EXISTS (
					SELECT FROM information_schema.columns 
					WHERE table_name = 'streams' AND column_name = 'id'
				) THEN 
					-- Check if live_chat_message table exists before modifying it
					IF EXISTS (
						SELECT FROM information_schema.tables 
						WHERE table_name = 'live_chat_message'
					) THEN
						-- First, drop dependent foreign key constraints
						ALTER TABLE "live_chat_message" DROP CONSTRAINT IF EXISTS "FK_live_chat_message_streamId";
					END IF;
					
					-- Drop the primary key constraint
					ALTER TABLE "streams" DROP CONSTRAINT IF EXISTS "PK_stream_id";
					
					-- Modify the column back to 32 characters (this might fail if data exists)
					ALTER TABLE "streams" ALTER COLUMN "id" TYPE character varying(32);
					
					-- Also revert the live_chat_message.streamId column if table exists
					IF EXISTS (
						SELECT FROM information_schema.tables 
						WHERE table_name = 'live_chat_message'
					) THEN
						ALTER TABLE "live_chat_message" ALTER COLUMN "streamId" TYPE character varying(32);
					END IF;
					
					-- Re-add the primary key constraint
					ALTER TABLE "streams" ADD CONSTRAINT "PK_stream_id" PRIMARY KEY ("id");
					
					-- Re-add the foreign key constraint if live_chat_message table exists
					IF EXISTS (
						SELECT FROM information_schema.tables 
						WHERE table_name = 'live_chat_message'
					) THEN
						ALTER TABLE "live_chat_message" ADD CONSTRAINT "FK_live_chat_message_streamId" 
							FOREIGN KEY ("streamId") REFERENCES "streams"("id") ON DELETE CASCADE;
					END IF;
				END IF;
			END $$;
		`);
	}
}
