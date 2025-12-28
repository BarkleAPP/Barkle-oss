export class AddInvitationRewardNotificationType1704672000000 {
	name = 'AddInvitationRewardNotificationType1704672000000'

	async up(queryRunner) {
		// Add the new notification type to the enum
		await queryRunner.query(`
			ALTER TYPE "notification_type_enum" ADD VALUE 'invitationReward'
		`);
	}

	async down(queryRunner) {
		// Note: PostgreSQL doesn't support removing enum values directly
		// This would require recreating the enum and updating all references
		// For now, we'll leave the enum value in place
		console.log('Cannot remove enum value invitationReward - PostgreSQL limitation');
	}
}