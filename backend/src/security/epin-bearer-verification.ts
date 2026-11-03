import {timingSafeEqual} from 'node:crypto';
import type {EpinKind} from './epin-batch';
import {hashOpaqueCredential} from './opaque-credential';
import {assertEpinRedemptionPreconditions,EpinRedemptionPreconditionError} from './epin-redemption-preconditions';
import type {EpinRedemptionContext,EpinRedemptionSnapshot} from './epin-redemption-preconditions';

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
 // Only registration-time ACTIVATION PINs exist in Nisvartha.
 // Reject legacy MEGA installment types even at the runtime JS boundary.
 if(expectedType!=='ACTIVATION')return false;
 const purpose='epin-activation';
 // Only RFC 4648 canonical unpadded base64url for 32 bytes is acceptable.
 // An alternate noncanonical encoding must not acquire bearer authority.
 const decoded=Buffer.from(presentedCode,'base64url');
 if(decoded.length!==32||decoded.toString('base64url')!==presentedCode)return false;
 const actual=hashOpaqueCredential(purpose,presentedCode);
 return timingSafeEqual(Buffer.from(actual,'hex'),Buffer.from(storedHash,'hex'));
}


/** Credential proof and metadata checks only; never payment or entitlement. */
export type RegistrationPinEvidenceSnapshot=EpinRedemptionSnapshot & {
 codeHash:string;
};

/**
 * Composes the two existing, pure registration-PIN guards.
 *
 * A true result means ONLY that the supplied 256-bit secret matches the
 * trusted digest and that the supplied metadata passes current policy checks.
 * It does NOT prove that an order was settled, that a stored PIN was issued,
 * that the member can register, or that single-use was transactionally claimed.
 *
 * The future approved DB adapter must obtain the record through authoritative
 * inventory access with row locks, then independently enforce settlement,
 * idempotency, atomic one-time consumption and audit.
 */
export function matchesRegistrationPinEvidence(
 record:RegistrationPinEvidenceSnapshot|undefined,
 presentedCode:unknown,
 context:EpinRedemptionContext
):boolean{
 if(!record||!matchesEpinBearer(record.codeHash,presentedCode,'ACTIVATION'))
  return false;
 try{
  assertEpinRedemptionPreconditions(record,context);
  return true;
 }catch(error){
  // Fail closed without leaking whether the PIN was expired, revoked, used,
  // assigned elsewhere, or associated with a different registration session.
  if(error instanceof EpinRedemptionPreconditionError||error instanceof TypeError)
   return false;
  throw error;
 }
}
