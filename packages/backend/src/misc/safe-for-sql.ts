import { In } from 'typeorm';
import { Users, UserProfiles, UserIps } from '@/models/index.js';
import { sendEmail } from '@/services/send-email.js';
import Logger from '@/services/logger.js';
import { getLogPath } from '@/misc/logging-config.js';

const securityLogger = new Logger('security', 'red', true, getLogPath('security-audit.log'));

export function safeForSql(text: string, ip?: string): boolean {
	if (/[\0\n\r"'\\%]/g.test(text)) {
		securityLogger.warn('Potential SQL Injection Blocked', {
			payload: text,
			ip: ip || 'unknown',
			timestamp: new Date().toISOString()
		}, true);

		// Notify admins and moderators asynchronously
		(async () => {
			try {
				let location = 'Unknown';
				let associatedUsers = 'None';

				if (ip) {
					// GeoIP Lookup
					try {
						const geo = await fetch(`http://ip-api.com/json/${ip}`).then(r => r.json() as any);
						if (geo && geo.status === 'success') {
							location = `${geo.city}, ${geo.country}`;
						}
					} catch (e) {
						// Ignore GeoIP failure
					}

					// User Lookup
					try {
						const ips = await UserIps.find({
							where: { ip: ip },
							take: 5
						});
						if (ips.length > 0) {
							const users = await Users.findBy({
								id: In(ips.map(x => x.userId))
							});
							associatedUsers = users.map(u => u.username).join(', ');
						}
					} catch (e) {
						// Ignore DB failure
					}
				}

				const staff = await Users.find({
					where: [
						{ isAdmin: true },
						{ isModerator: true }
					],
					select: ['id']
				});

				if (staff.length === 0) return;

				const profiles = await UserProfiles.find({
					where: {
						userId: In(staff.map(u => u.id))
					},
					select: ['userId', 'email']
				});

				for (const profile of profiles) {
					if (profile.email) {
						const htmlBody = `
							<div style="font-family: sans-serif; padding: 20px; border: 1px solid #e74c3c; border-radius: 5px;">
								<h2 style="color: #c0392b; margin-top: 0;">High Priority Security Alert</h2>
								<p>A potential SQL injection attempt was blocked.</p>
								<table style="width: 100%; border-collapse: collapse;">
									<tr>
										<td style="padding: 8px; font-weight: bold; width: 150px;">Payload:</td>
										<td style="padding: 8px; background: #f8f9fa; font-family: monospace;">${text}</td>
									</tr>
									<tr>
										<td style="padding: 8px; font-weight: bold;">IP Address:</td>
										<td style="padding: 8px;">${ip || 'Unknown'} (${location})</td>
									</tr>
									<tr>
										<td style="padding: 8px; font-weight: bold;">Associated Users:</td>
										<td style="padding: 8px;">${associatedUsers}</td>
									</tr>
									<tr>
										<td style="padding: 8px; font-weight: bold;">Time:</td>
										<td style="padding: 8px;">${new Date().toISOString()}</td>
									</tr>
								</table>
							</div>
						`;

						const textBody = `
High Priority Security Alert
----------------------------
Payload: ${text}
IP Address: ${ip || 'Unknown'} (${location})
Associated Users: ${associatedUsers}
Time: ${new Date().toISOString()}
						`;

						sendEmail(
							profile.email,
							'Security Alert: SQL Injection Blocked',
							textBody,
							htmlBody
						).catch(e => securityLogger.error(`Failed to send email to ${profile.userId}: ${e}`));
					}
				}
			} catch (err) {
				securityLogger.error(`Failed to dispatch security emails: ${err}`);
			}
		})();

		return false;
	}
	return true;
}
