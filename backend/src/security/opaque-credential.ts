import {createHash,randomBytes} from 'node:crypto';

/**
 * Reusable 256-bit bearer material for one-time, purpose-bound credentials.
 * A generated secret has no issuance, payment, membership or redemption state.
 * Callers must persist only a digest and enforce lifecycle rules transactionally.
 */
const SECRET_BYTES=32;
const CREDENTIAL_PATTERN=/^[A-Za-z0-9_-]{43}$/;
const PURPOSE_PATTERN=/^[a-z][a-z0-9-]{1,63}$/;

export function generateOpaqueCredential():string{
 return randomBytes(SECRET_BYTES).toString('base64url');
}

/**
 * Preserves the existing member-recovery v1 hash format exactly.
 * Purpose separation prevents a credential in one domain being accepted in another.
 * Appropriate only for high-entropy machine-generated credentials; never passwords
 * or low-entropy human-selected PINs.
 */
export function hashOpaqueCredential(purpose:string,credential:string):string{
 if(!PURPOSE_PATTERN.test(purpose))throw new TypeError('Invalid credential purpose');
 if(!CREDENTIAL_PATTERN.test(credential))throw new TypeError('Invalid credential encoding');
 return createHash('sha256').update('nisvartha:'+purpose+':v1:'+credential).digest('hex');
}
