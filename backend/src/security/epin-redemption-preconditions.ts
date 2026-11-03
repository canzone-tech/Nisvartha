/**
 * MEGA-derived, registration-only metadata checks for a *future* E-PIN
 * redemption. Nisvartha has no installment payment or installment E-PIN.
 * This is NOT a financial/settlement check, PIN lookup, identity check,
 * idempotent reservation, membership approval, or an authorization to redeem.
 * Call only after looking up an authentic issued record under DB row lock.
 */
import type {EpinKind} from './epin-batch';

export type EpinRedemptionSnapshot={
 status:string;
 pinType:string;
 expiresAt:Date|string;
 usedAt:Date|string|null;
 revokedAt:Date|string|null;
 assignedMemberId:string|null;
 sessionId:string|null;
 sessionStatus:string|null;
 programLifecycle:string|null;
 currencyCodeSnapshot:string|null;
 sessionCurrencyCode:string|null;
 registrationFeeSnapshot:string|null;
};
export type EpinRedemptionContext={
 memberId:string;
 expectedSessionId:string;
 expectedType:EpinKind;
 now:Date;
};
export type EpinRedemptionPreconditionCode=
 'NOT_ACTIVE'|'WRONG_TYPE'|'WRONG_MEMBER'|'WRONG_SESSION'|
 'SESSION_UNAVAILABLE'|'INVALID_SNAPSHOT'|'CURRENCY_MISMATCH';

export class EpinRedemptionPreconditionError extends Error{
 constructor(public readonly code:EpinRedemptionPreconditionCode){
  // Do not disclose whether a bearer exists, is assigned to another member,
  // has been used, or is expired in eventual public redemption responses.
  super('E-PIN cannot be redeemed');
  this.name='EpinRedemptionPreconditionError';
 }
}
function fail(code:EpinRedemptionPreconditionCode):never{
 throw new EpinRedemptionPreconditionError(code);
}
const money=/^(?:0|[1-9]\d{0,11})\.\d{2}$/;
const currency=/^[A-Z]{3}$/;
function validTimestamp(value:Date|string):number{
 if(value instanceof Date)return value.getTime();
 if(typeof value!=='string')return NaN;
 // The future DB adapter should supply Date values. Never guess timezones.
 if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(value))return NaN;
 const parsed=Date.parse(value);
 if(!Number.isFinite(parsed))return NaN;
 // Date.parse() normalizes invalid calendar dates on some runtimes.
 return new Date(parsed).toISOString().slice(0,19)===value.slice(0,19)?parsed:NaN;
}
function positiveReference(value:string):boolean{
 return typeof value==='string'&&value.length>0&&value.trim()===value;
}
export function assertEpinRedemptionPreconditions(
 record:EpinRedemptionSnapshot|undefined,
 context:EpinRedemptionContext
):void{
 if(!context||!positiveReference(context.memberId)||
    !positiveReference(context.expectedSessionId)||
    context.expectedType!=='ACTIVATION'||
    !(context.now instanceof Date)||!Number.isFinite(context.now.getTime())){
  throw new TypeError('Invalid E-PIN redemption context');
 }
 const expiry=record?validTimestamp(record.expiresAt):NaN;
 if(!record||record.status!=='ACTIVE'||record.usedAt!==null||
    record.revokedAt!==null||!Number.isFinite(expiry)||
    expiry<=context.now.getTime())fail('NOT_ACTIVE');
 if(record.pinType!==context.expectedType)fail('WRONG_TYPE');
 if(record.assignedMemberId!==null &&
   record.assignedMemberId!==context.memberId)fail('WRONG_MEMBER');
 if(!positiveReference(record.sessionId??'')||
    record.sessionId!==context.expectedSessionId)fail('WRONG_SESSION');
 if(record.sessionStatus!=='ACTIVE'||record.programLifecycle!=='PUBLISHED')
  fail('SESSION_UNAVAILABLE');
 if(!record.currencyCodeSnapshot||!currency.test(record.currencyCodeSnapshot)||
   !record.sessionCurrencyCode||!currency.test(record.sessionCurrencyCode)||
   typeof record.registrationFeeSnapshot!=='string'||
   !money.test(record.registrationFeeSnapshot))
  fail('INVALID_SNAPSHOT');
 if(record.sessionCurrencyCode!==record.currencyCodeSnapshot)fail('CURRENCY_MISMATCH');
}
