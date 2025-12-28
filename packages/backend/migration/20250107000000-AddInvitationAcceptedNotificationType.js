export class AddInvitationAcceptedNotificationType1704585600000 {
	name = 'AddInvitationAcceptedNotificationType1704585600000'

	async up(queryRunner) {
		// Add the new notification type to the enum
		await queryRunner.query(`
			ALTER TYPE "notification_type_enum" ADD VALUE 'invitationAccepted'
		`);
	}

	async down(queryRunner) {
		// Note: PostgreSQL doesn't support removing enum values directly
		// This would require recreating the enum and updating all references
		// For now, we'll leave the enum value in place
		console.log('Cannot remove enum value invitationAccepted - PostgreSQL limitation');
	}
}