import { IsNull } from 'typeorm';
import { Users } from '@/models/index.js';
import define from '../../define.js';
import { MINUTE } from '@/const.js';

export const meta = {
  tags: ['users'],
  requireCredential: false,

  limit: {
    duration: MINUTE,
    max: 10,
  },

  res: {
    type: 'object',
    properties: {
      available: {
        type: 'boolean',
      },
    },
    required: ['available'],
  },
} as const;

export const paramDef = {
  type: 'object',
  properties: {
    username: Users.localUsernameSchema,
  },
  required: ['username'],
} as const;

export default define(meta, paramDef, async (ps) => {
  const lowercaseUsername = ps.username.toLowerCase();

  const exist = await Users.countBy({
    host: IsNull(),
    usernameLower: lowercaseUsername,
  });

  return {
    available: exist === 0,
  };
});