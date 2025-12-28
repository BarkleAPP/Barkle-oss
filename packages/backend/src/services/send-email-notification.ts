import { UserProfiles } from '@/models/index.js';
import { User } from '@/models/entities/user.js';
import { Note } from '@/models/entities/note.js';
import { UserGroup } from '@/models/entities/user-group.js';
import { sendEmail } from './send-email.js';
import * as Acct from '@/misc/acct.js';
import config from '@/config/index.js';
import { getNoteSummary } from '@/misc/get-note-summary.js';

function getUserDisplayName(user: User): string {
  return user.name || `@${Acct.toString(user)}`;
}

function getEmailTemplate(content: string): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Barkle Notification</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      background-color: #0d0d0d;
      line-height: 1.6;
    }
    .email-container {
      max-width: 600px;
      margin: 20px auto;
      background-color: #191919;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.5);
    }
    .email-header {
      background: linear-gradient(135deg, #e84d83 0%, #c73866 100%);
      padding: 30px 20px;
      text-align: center;
      color: white;
    }
    .email-header h1 {
      margin: 0;
      font-size: 28px;
      font-weight: 700;
    }
    .email-header p {
      margin: 8px 0 0 0;
      font-size: 14px;
      opacity: 0.9;
    }
    .email-body {
      padding: 30px 20px;
      color: #dadada;
    }
    .profile-card {
      display: flex;
      align-items: center;
      padding: 16px;
      background-color: #1f1f1f;
      border-radius: 8px;
      margin: 20px 0;
      border: 1px solid rgba(255, 255, 255, 0.1);
    }
    .profile-avatar {
      width: 48px;
      height: 48px;
      border-radius: 50%;
      margin-right: 12px;
      background-color: #e84d83;
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 20px;
      font-weight: 600;
    }
    .profile-info h3 {
      margin: 0;
      font-size: 16px;
      font-weight: 600;
      color: #dadada;
    }
    .profile-info p {
      margin: 2px 0 0 0;
      font-size: 14px;
      color: #888;
    }
    .bark-card {
      background-color: #1f1f1f;
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 12px;
      padding: 28px 20px 18px;
      margin: 20px 0;
    }
    .bark-header {
      display: flex;
      align-items: flex-start;
      margin-bottom: 12px;
    }
    .bark-avatar {
      width: 48px;
      height: 48px;
      border-radius: 50%;
      margin-right: 14px;
      background-color: #e84d83;
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 18px;
      font-weight: 600;
      flex-shrink: 0;
    }
    .bark-author h4 {
      margin: 0;
      font-size: 15px;
      font-weight: 600;
      color: #dadada;
    }
    .bark-author p {
      margin: 2px 0 0 0;
      font-size: 13px;
      color: #888;
    }
    .bark-content {
      font-size: 15px;
      color: #dadada;
      line-height: 1.5;
      margin: 12px 0;
      word-wrap: break-word;
    }
    .bark-footer {
      display: flex;
      gap: 16px;
      margin-top: 12px;
      padding-top: 12px;
      border-top: 1px solid rgba(255, 255, 255, 0.1);
      font-size: 13px;
      color: #888;
    }
    .btn-primary {
      display: inline-block;
      padding: 12px 24px;
      background: linear-gradient(135deg, #e84d83 0%, #c73866 100%);
      color: white;
      text-decoration: none;
      border-radius: 8px;
      font-weight: 600;
      text-align: center;
      margin: 20px 0;
    }
    .btn-secondary {
      display: inline-block;
      padding: 10px 20px;
      background-color: rgba(255, 255, 255, 0.05);
      color: #dadada;
      text-decoration: none;
      border-radius: 6px;
      font-weight: 500;
      font-size: 14px;
      border: 1px solid rgba(255, 255, 255, 0.1);
    }
    .divider {
      height: 1px;
      background-color: rgba(255, 255, 255, 0.1);
      margin: 30px 0;
    }
    .email-footer {
      background-color: #1f1f1f;
      padding: 20px;
      text-align: center;
      font-size: 13px;
      color: #888;
      border-top: 1px solid rgba(255, 255, 255, 0.1);
    }
    .email-footer a {
      color: #e84d83;
      text-decoration: none;
    }
    .notification-badge {
      display: inline-block;
      padding: 4px 12px;
      background-color: rgba(232, 77, 131, 0.15);
      color: #e84d83;
      border-radius: 12px;
      font-size: 12px;
      font-weight: 600;
      margin-bottom: 12px;
      border: 1px solid rgba(232, 77, 131, 0.3);
    }
  </style>
</head>
<body>
  <div class="email-container">
    <div class="email-header">
      <h1>🐾 Barkle</h1>
      <p>Bark it out on Barkle</p>
    </div>
    <div class="email-body">
      ${content}
    </div>
    <div class="email-footer">
      <p>You're receiving this email because you have email notifications enabled.</p>
      <p><a href="${config.url}/settings/email">Manage notification preferences</a> • <a href="${config.url}">Visit Barkle</a></p>
      <p style="margin-top: 16px; font-size: 12px; color: #666;">
        © ${new Date().getFullYear()} Barkle. All rights reserved.
      </p>
    </div>
  </div>
</body>
</html>
  `;
}

function getUserAvatarInitial(user: User): string {
  const name = getUserDisplayName(user);
  return name.charAt(0).toUpperCase();
}

function escapeHtml(text: string | null | undefined): string {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

async function follow(userId: User['id'], follower: User) {
  const userProfile = await UserProfiles.findOneByOrFail({ userId: userId });
  if (!userProfile.email || !userProfile.emailNotificationTypes.includes('follow')) return;

  const followerName = getUserDisplayName(follower);
  const followerUsername = Acct.toString(follower);
  const avatarInitial = getUserAvatarInitial(follower);

  const subject = `${followerName} followed you on Barkle`;
  const text = `${followerName} (@${followerUsername}) is now following you on Barkle.`;

  const content = `
    <span class="notification-badge">👤 New Follower</span>
    <h2 style="margin: 0 0 8px 0; font-size: 20px; color: #dadada;">You have a new follower!</h2>
    <p style="color: #888; margin-bottom: 24px;">Someone just started following you on Barkle.</p>
    
    <div class="profile-card">
      <div class="profile-avatar">${avatarInitial}</div>
      <div class="profile-info">
        <h3>${escapeHtml(followerName)}</h3>
        <p>@${escapeHtml(followerUsername)}</p>
      </div>
    </div>
    
    <a href="${config.url}/@${followerUsername}" class="btn-primary" style="display: block; text-align: center;">View Profile</a>
    
    <div class="divider"></div>
    
    <p style="font-size: 14px; color: #888; text-align: center;">
      <a href="${config.url}/notifications" class="btn-secondary">View All Notifications</a>
    </p>
  `;

  await sendEmail(userProfile.email, subject, getEmailTemplate(content), text);
}

async function receiveFollowRequest(userId: User['id'], follower: User) {
  const userProfile = await UserProfiles.findOneByOrFail({ userId: userId });
  if (!userProfile.email || !userProfile.emailNotificationTypes.includes('receiveFollowRequest')) return;

  const followerName = getUserDisplayName(follower);
  const followerUsername = Acct.toString(follower);
  const avatarInitial = getUserAvatarInitial(follower);

  const subject = `${followerName} wants to follow you on Barkle`;
  const text = `${followerName} (@${followerUsername}) has requested to follow you on Barkle.`;

  const content = `
    <span class="notification-badge">🔔 Follow Request</span>
    <h2 style="margin: 0 0 8px 0; font-size: 20px; color: #dadada;">New follow request</h2>
    <p style="color: #888; margin-bottom: 24px;">Someone wants to follow you. Review their profile and decide.</p>
    
    <div class="profile-card">
      <div class="profile-avatar">${avatarInitial}</div>
      <div class="profile-info">
        <h3>${escapeHtml(followerName)}</h3>
        <p>@${escapeHtml(followerUsername)}</p>
      </div>
    </div>
    
    <a href="${config.url}/notifications" class="btn-primary" style="display: block; text-align: center;">Review Request</a>
    
    <div class="divider"></div>
    
    <p style="font-size: 14px; color: #888; text-align: center;">
      You can approve or reject this request in your notifications.
    </p>
  `;

  await sendEmail(userProfile.email, subject, getEmailTemplate(content), text);
}

async function mention(userId: User['id'], mentioner: User, note: Note) {
  const userProfile = await UserProfiles.findOneByOrFail({ userId: userId });
  if (!userProfile.email || !userProfile.emailNotificationTypes.includes('mention')) return;

  const mentionerName = getUserDisplayName(mentioner);
  const mentionerUsername = Acct.toString(mentioner);
  const avatarInitial = getUserAvatarInitial(mentioner);
  const noteSummary = note.text ? note.text.substring(0, 200) + (note.text.length > 200 ? '...' : '') : '[No text content]';

  const subject = `${mentionerName} mentioned you in a bark`;
  const text = `${mentionerName} (@${mentionerUsername}) mentioned you: ${noteSummary}`;

  const content = `
    <span class="notification-badge">@ Mention</span>
    <h2 style="margin: 0 0 8px 0; font-size: 20px; color: #dadada;">${escapeHtml(mentionerName)} mentioned you</h2>
    <p style="color: #888; margin-bottom: 24px;">You were mentioned in a bark.</p>
    
    <div class="bark-card">
      <div class="bark-header">
        <div class="bark-avatar">${avatarInitial}</div>
        <div class="bark-author">
          <h4>${escapeHtml(mentionerName)}</h4>
          <p>@${escapeHtml(mentionerUsername)}</p>
        </div>
      </div>
      <div class="bark-content">
        ${escapeHtml(noteSummary)}
      </div>
      <div class="bark-footer">
        <span>🐾 Bark</span>
      </div>
    </div>
    
    <a href="${config.url}/notes/${note.id}" class="btn-primary" style="display: block; text-align: center;">View Bark</a>
    
    <div class="divider"></div>
    
    <p style="font-size: 14px; color: #888; text-align: center;">
      <a href="${config.url}/notifications" class="btn-secondary">View All Notifications</a>
    </p>
  `;

  await sendEmail(userProfile.email, subject, getEmailTemplate(content), text);
}

async function reply(userId: User['id'], replier: User, note: Note) {
  const userProfile = await UserProfiles.findOneByOrFail({ userId: userId });
  if (!userProfile.email || !userProfile.emailNotificationTypes.includes('reply')) return;

  const replierName = getUserDisplayName(replier);
  const replierUsername = Acct.toString(replier);
  const avatarInitial = getUserAvatarInitial(replier);
  const noteSummary = note.text ? note.text.substring(0, 200) + (note.text.length > 200 ? '...' : '') : '[No text content]';

  const subject = `${replierName} replied to your bark`;
  const text = `${replierName} (@${replierUsername}) replied to your bark: ${noteSummary}`;

  const content = `
    <span class="notification-badge">💬 Reply</span>
    <h2 style="margin: 0 0 8px 0; font-size: 20px; color: #dadada;">${escapeHtml(replierName)} replied to your bark</h2>
    <p style="color: #888; margin-bottom: 24px;">Someone responded to your bark.</p>
    
    <div class="bark-card">
      <div class="bark-header">
        <div class="bark-avatar">${avatarInitial}</div>
        <div class="bark-author">
          <h4>${escapeHtml(replierName)}</h4>
          <p>@${escapeHtml(replierUsername)}</p>
        </div>
      </div>
      <div class="bark-content">
        ${escapeHtml(noteSummary)}
      </div>
      <div class="bark-footer">
        <span>↩️ Reply</span>
      </div>
    </div>
    
    <a href="${config.url}/notes/${note.id}" class="btn-primary" style="display: block; text-align: center;">View Reply</a>
    
    <div class="divider"></div>
    
    <p style="font-size: 14px; color: #888; text-align: center;">
      <a href="${config.url}/notifications" class="btn-secondary">View All Notifications</a>
    </p>
  `;

  await sendEmail(userProfile.email, subject, getEmailTemplate(content), text);
}

async function quote(userId: User['id'], quoter: User, note: Note) {
  const userProfile = await UserProfiles.findOneByOrFail({ userId: userId });
  if (!userProfile.email || !userProfile.emailNotificationTypes.includes('quote')) return;

  const quoterName = getUserDisplayName(quoter);
  const quoterUsername = Acct.toString(quoter);
  const avatarInitial = getUserAvatarInitial(quoter);
  const noteSummary = note.text ? note.text.substring(0, 200) + (note.text.length > 200 ? '...' : '') : '[No text content]';

  const subject = `${quoterName} quoted your bark`;
  const text = `${quoterName} (@${quoterUsername}) quoted your bark: ${noteSummary}`;

  const content = `
    <span class="notification-badge">🔁 Quote</span>
    <h2 style="margin: 0 0 8px 0; font-size: 20px; color: #dadada;">${escapeHtml(quoterName)} quoted your bark</h2>
    <p style="color: #888; margin-bottom: 24px;">Someone shared your bark with their thoughts.</p>
    
    <div class="bark-card">
      <div class="bark-header">
        <div class="bark-avatar">${avatarInitial}</div>
        <div class="bark-author">
          <h4>${escapeHtml(quoterName)}</h4>
          <p>@${escapeHtml(quoterUsername)}</p>
        </div>
      </div>
      <div class="bark-content">
        ${escapeHtml(noteSummary)}
      </div>
      <div class="bark-footer">
        <span>🔁 Quote Bark</span>
      </div>
    </div>
    
    <a href="${config.url}/notes/${note.id}" class="btn-primary" style="display: block; text-align: center;">View Quote</a>
    
    <div class="divider"></div>
    
    <p style="font-size: 14px; color: #888; text-align: center;">
      <a href="${config.url}/notifications" class="btn-secondary">View All Notifications</a>
    </p>
  `;

  await sendEmail(userProfile.email, subject, getEmailTemplate(content), text);
}

async function groupInvite(userId: User['id'], inviter: User, group: UserGroup) {
  const userProfile = await UserProfiles.findOneByOrFail({ userId: userId });
  if (!userProfile.email || !userProfile.emailNotificationTypes.includes('groupInvite')) return;

  const inviterName = getUserDisplayName(inviter);
  const inviterUsername = Acct.toString(inviter);
  const avatarInitial = getUserAvatarInitial(inviter);

  const subject = `${inviterName} invited you to join "${group.name}"`;
  const text = `${inviterName} (@${inviterUsername}) invited you to join the group "${group.name}" on Barkle.`;

  const content = `
    <span class="notification-badge">👥 Group Invite</span>
    <h2 style="margin: 0 0 8px 0; font-size: 20px; color: #dadada;">You've been invited to a group</h2>
    <p style="color: #888; margin-bottom: 24px;">${escapeHtml(inviterName)} wants you to join their group.</p>
    
    <div style="background-color: #1f1f1f; border-radius: 8px; padding: 20px; margin: 20px 0; text-align: center; border: 1px solid rgba(255, 255, 255, 0.1);">
      <div style="font-size: 32px; margin-bottom: 12px;">👥</div>
      <h3 style="margin: 0 0 8px 0; font-size: 18px; color: #dadada;">${escapeHtml(group.name)}</h3>
      <p style="margin: 0; font-size: 14px; color: #888;">Group Invitation</p>
    </div>
    
    <div class="profile-card">
      <div class="profile-avatar">${avatarInitial}</div>
      <div class="profile-info">
        <h3>Invited by ${escapeHtml(inviterName)}</h3>
        <p>@${escapeHtml(inviterUsername)}</p>
      </div>
    </div>
    
    <a href="${config.url}/notifications" class="btn-primary" style="display: block; text-align: center;">Review Invitation</a>
    
    <div class="divider"></div>
    
    <p style="font-size: 14px; color: #888; text-align: center;">
      You can accept or decline this invitation in your notifications.
    </p>
  `;

  await sendEmail(userProfile.email, subject, getEmailTemplate(content), text);
}

async function socialReminder(userId: User['id'], reminderData: {
  title: string;
  body: string;
  clickAction?: string;
}) {
  const userProfile = await UserProfiles.findOneByOrFail({ userId: userId });

  // Check if user wants email reminders
  if (!userProfile.email || !userProfile.receiveEmailReminders) return;
  if (!userProfile.emailNotificationTypes.includes('socialReminder')) return;

  const subject = reminderData.title;
  const text = reminderData.body;

  const content = `
    <span class="notification-badge">🔔 Reminder</span>
    <h2 style="margin: 0 0 8px 0; font-size: 20px; color: #dadada;">${escapeHtml(reminderData.title)}</h2>
    <p style="color: #888; margin-bottom: 24px;">${escapeHtml(reminderData.body)}</p>
    
    <div style="background: linear-gradient(135deg, #e84d83 0%, #c73866 100%); border-radius: 12px; padding: 30px; text-align: center; color: white; margin: 24px 0;">
      <div style="font-size: 48px; margin-bottom: 16px;">🐾</div>
      <h3 style="margin: 0 0 12px 0; font-size: 22px; font-weight: 600;">Come back to Barkle!</h3>
      <p style="margin: 0; opacity: 0.9; font-size: 15px;">Your community is waiting for you.</p>
    </div>
    
    <a href="${config.url}${reminderData.clickAction || '/'}" class="btn-primary" style="display: block; text-align: center;">Visit Barkle</a>
    
    <div class="divider"></div>
    
    <div style="background-color: #1f1f1f; border-radius: 8px; padding: 16px; font-size: 13px; color: #888; border: 1px solid rgba(255, 255, 255, 0.1);">
      <p style="margin: 0 0 8px 0;"><strong style="color: #dadada;">ℹ️ About Social Reminders</strong></p>
      <p style="margin: 0;">This reminder is based on real activity from your friends and community. Reminders are only sent when platform activity is low.</p>
    </div>
    
    <p style="font-size: 13px; color: #666; text-align: center; margin-top: 20px;">
      You're receiving this because you have social reminders enabled.<br>
      <a href="${config.url}/settings/email" style="color: #e84d83;">Manage notification preferences</a>
    </p>
  `;

  await sendEmail(userProfile.email, subject, getEmailTemplate(content), text);
}

export const sendEmailNotification = {
  follow,
  receiveFollowRequest,
  mention,
  reply,
  quote,
  groupInvite,
  socialReminder,
};