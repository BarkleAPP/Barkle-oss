import { IEndpoint } from './endpoints.js';

import * as cp___instanceInfo from './endpoints/compatibility/instance-info.js';
import * as cp___customEmojis from './endpoints/compatibility/custom-emojis.js';

const cps: Array<[string, any]> = [
	['v1/instance', cp___instanceInfo],
	['v1/custom_emojis', cp___customEmojis],
];

const compatibility: IEndpoint[] = cps.map(([name, cp]): IEndpoint => {
	// Type guard to ensure cp is an object with the expected properties
	if (typeof cp === 'string' || !cp || typeof cp !== 'object') {
		console.error(`Invalid compatibility endpoint module for ${String(name)}:`, cp);
		throw new Error(`Invalid compatibility endpoint module: ${String(name)}`);
	}
	
	return {
		name: String(name),
		exec: (cp as any).default,
		meta: (cp as any).meta || {},
		params: (cp as any).paramDef,
	} as IEndpoint;
});

export default compatibility;
