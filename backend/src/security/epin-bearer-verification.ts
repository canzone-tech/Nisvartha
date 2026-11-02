import {timingSafeEqual} from 'node:crypto';
import type {EpinKind} from './epin-batch';
import {hashOpaqueCredential} from './opaque-credential';

/**
 * Pure, purpose-separated verification of a hypothetical issued E-PIN bearer.
 * Never queries inventory, issues a PIN, settles payment or consumes a claim.
 *
 * The trusted stored digest must have come from an authoritative, row-locked
 * issued record, never from user input. For untrusted/missing inputs, return
 * only false; do not expose which part failed or echo the bearer.
 *
 * IMPORTANT: successful matching proves possession of a secret only. The
 * caller must still enforce E-PIN redemption preconditions, settled payment,
 * transactional single-use/idempotency, member ownership and audit.
 */
const CANONICAL_CODE=/^[A-Za-z0-9_-]{43}$/;
const STORED_HASH=/^[0-9a-f]{64}$/;

export function matchesEpinBearer(
 storedHash:unknown,
 presentedCode:unknown,
 expectedType:EpinKind
):boolean{
 if(typeof storedHash!=='string'||!STORED_HASH.test(storedHash)||
    typeof presentedCode!=='string'||!CANONICAL_CODE.test(presentedCode))
  return false;
 const purpose=expectedType==='ACTIVATION'?'epin-activation':
  expectedType==='INSTALLMENT'?'epin-installment':null;
 if(!purpose)return false;
 // Only RFC 4648 canonical unpadded base64url for 32 bytes is acceptable.
 // An alternate noncanonical encoding must not acquire bearer authority.
 const decoded=Buffer.from(presentedCode,'base64url');
 if(decoded.length!==32||decoded.toString('base64url')!==presentedCode)return false;
 const actual=hashOpaqueCredential(purpose,presentedCode);
 return timingSafeEqual(Buffer.from(actual,'hex'),Buffer.from(storedHash,'hex'));
}
