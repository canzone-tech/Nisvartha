import {randomUUID} from 'node:crypto';
import {generateOpaqueCredential,hashOpaqueCredential} from './opaque-credential';

/**
 * Nisvartha registration-only E-PIN candidate preparation. MEGA's
 * INSTALLMENT payment/PIN type is deliberately not part of this domain.
 * No issue/save/redeem/payment path.
 * A candidate is NOT a valid/active/paid E-PIN and must never be given to
 * members before a future approved atomic persistence + settlement workflow.
 */
/** Historical internal identifier for the single registration-time E-PIN. */
export type EpinKind='ACTIVATION';
export type EpinBatchRequest={
 quantity:number;
 expiresAt:string;
 pinType?:EpinKind;
};
export type ValidatedEpinBatch={
 quantity:number;
 pinType:EpinKind;
 expiresAt:string;
};

export type UnissuedEpinCandidate={
 id:string;
 code:string;
 codeHash:string;
 displaySuffix:string;
 pinType:EpinKind;
 expiresAt:string;
};

const MAX_BATCH=500;
const ISO_WITH_ZONE=/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,3})?(Z|([+-])(\d{2}):(\d{2}))$/;

function parseExpiry(value:string,now:Date):string{
 if(typeof value!=='string')throw new TypeError('E-PIN expiry must include a timezone');
 const m=ISO_WITH_ZONE.exec(value);
 if(!m)throw new TypeError('E-PIN expiry must be an ISO timestamp with timezone');
 const year=Number(m[1]),month=Number(m[2]),day=Number(m[3]);
 const hour=Number(m[4]),minute=Number(m[5]),second=Number(m[6]);
 const zoneHour=m[9]===undefined?0:Number(m[9]);
 const zoneMinute=m[10]===undefined?0:Number(m[10]);
 const calendar=new Date(Date.UTC(year,month-1,day));
 if(calendar.getUTCFullYear()!==year||calendar.getUTCMonth()+1!==month||
   calendar.getUTCDate()!==day||hour>23||minute>59||second>59||
   zoneHour>23||zoneMinute>59)throw new RangeError('Invalid E-PIN expiry timestamp');
 const expiry=new Date(value);
 if(!Number.isFinite(expiry.getTime())||expiry.getTime()<=now.getTime())
  throw new RangeError('E-PIN expiry must be in the future');
 return expiry.toISOString();
}

/**
 * Prepare a bounded, unique batch of secrets for a *future* approved issuance
 * transaction. The code is visible in process memory only; no DB or logging.
 * Caller must enforce authenticated ADMIN/SUPER_ADMIN RBAC, payment settlement,
 * idempotency, audit, and one-use redemption. This function enforces NONE of
 * those business/authorization requirements and must never be exposed as API.
 */
/**
 * Pure input validation for authenticated staff previews and future issuance.
 * Does not generate secrets, persist records, or grant paid entitlement.
 */
export function validateEpinBatchRequest(
 request:EpinBatchRequest,now:Date=new Date()
):ValidatedEpinBatch{
 if(!request||typeof request!=='object')throw new TypeError('E-PIN batch request required');
 if(!Number.isInteger(request.quantity)||request.quantity<1||request.quantity>MAX_BATCH)
  throw new RangeError('E-PIN batch quantity must be between 1 and 500');
 const pinType=request.pinType===undefined?'ACTIVATION':request.pinType;
 if(pinType!=='ACTIVATION')
  throw new TypeError('Unsupported E-PIN kind');
 if(!(now instanceof Date)||!Number.isFinite(now.getTime()))
  throw new TypeError('Invalid generation clock');
 return {quantity:request.quantity,pinType,expiresAt:parseExpiry(request.expiresAt,now)};
}

/**
 * Cryptographic candidates are only ephemeral until a separately authorized,
 * audited and transactionally persisted issuance workflow exists.
 */
export function prepareEpinBatch(
 request:EpinBatchRequest,now:Date=new Date()
):UnissuedEpinCandidate[]{
 const {quantity,pinType,expiresAt}=validateEpinBatchRequest(request,now);
 const domain='epin-activation';
 const seen=new Set<string>();
 const result:UnissuedEpinCandidate[]=[];
 for(let n=0;n<quantity;n++){
  const code=generateOpaqueCredential();
  const codeHash=hashOpaqueCredential(domain,code);
  if(seen.has(codeHash))throw new Error('E-PIN candidate collision');
  seen.add(codeHash);
  result.push({id:randomUUID(),code,codeHash,
   displaySuffix:code.slice(-6),pinType,expiresAt});
 }
 return result;
}
