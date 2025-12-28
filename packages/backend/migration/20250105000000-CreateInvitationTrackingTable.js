export class CreateInvitationTrackingTable1704412800000 {
	name = 'CreateInvitationTrackingTable1704412800000'

	async up(queryRunner) {
		await queryRunner.query(`
			CREATE TABLE "invitation_tracking" (
				"id" varchar(32) NOT NULL,
				"inviterId" varchar(32) NOT NULL,
				"inviteCode" varchar(32) NOT NULL,
				"method" varchar NOT NULL CHECK ("method" IN ('sms', 'email', 'social', 'link')),
				"recipientIdentifier" varchar(255),
				"recipientName" varchar(255),
				"isAccepted" boolean NOT NULL DEFAULT false,
				"acceptedUserId" varchar(32),
				"createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
				"acceptedAt" TIMESTAMP WITH TIME ZONE,
				"expiresAt" TIMESTAMP WITH TIME ZONE,
				"metadata" jsonb NOT NULL DEFAULT '{}',
				CONSTRAINT "PK_invitation_tracking" PRIMARY KEY ("id"),
				CONSTRAINT "UQ_invitation_tracking_inviteCode" UNIQUE ("inviteCode"),
				CONSTRAINT "FK_invitation_tracking_inviter" FOREIGN KEY ("inviterId") REFERENCES "user"("id") ON DELETE CASCADE,
				CONSTRAINT "FK_invitation_tracking_acceptedUser" FOREIGN KEY ("acceptedUserId") REFERENCES "user"("id") ON DELETE SET NULL
			)
		`);

		await queryRunner.query(`
			CREATE INDEX "IDX_invitation_tracking_inviterId" ON "invitation_tracking" ("inviterId")
		`);

		await queryRunner.query(`
			CREATE INDEX "IDX_invitation_tracking_inviteCode" ON "invitation_tracking" ("inviteCode")
		`);

		await queryRunner.query(`
			CREATE INDEX "IDX_invitation_tracking_acceptedUserId" ON "invitation_tracking" ("acceptedUserId")
		`);

		await queryRunner.query(`
			CREATE INDEX "IDX_invitation_tracking_createdAt" ON "invitation_tracking" ("createdAt")
		`);
	}

	async down(queryRunner) {
		await queryRunner.query(`DROP INDEX "IDX_invitation_tracking_createdAt"`);
		await queryRunner.query(`DROP INDEX "IDX_invitation_tracking_acceptedUserId"`);
		await queryRunner.query(`DROP INDEX "IDX_invitation_tracking_inviteCode"`);
		await queryRunner.query(`DROP INDEX "IDX_invitation_tracking_inviterId"`);
		await queryRunner.query(`DROP TABLE "invitation_tracking"`);
	}
}