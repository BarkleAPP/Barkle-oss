import * as crypto from 'crypto';

const L_CHARS = '0123456789abcdefghijklmnopqrstuvwxyz';
const LU_CHARS = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';

export function secureRndstr(length = 32, useLU = true): string {
	const chars = useLU ? LU_CHARS : L_CHARS;
	const chars_len = chars.length;

	let str = '';
	const randomBytes = crypto.randomBytes(length);

	for (let i = 0; i < length; i++) {
		str += chars.charAt(randomBytes[i] % chars_len);
	}

	return str;
}

