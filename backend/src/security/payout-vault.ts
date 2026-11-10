import {createCipheriv,createDecipheriv,hkdfSync,randomBytes} from 'node:crypto';

/** Financial PII is encrypted with its own domain-separated subkey.
 * Uses the existing backed-up PIN_VAULT_KEY: rotating/discarding it will make
 * existing PINs AND payout destinations unreadable. Never log plaintext.
 */
type DestinationScope='bank-profile'|'upi-profile'|'payout-snapshot';
export type BankDestination={method:'BANK';holderName:string;accountNumber:string;ifsc:string};
export type UpiDestination={method:'UPI';upiId:string};
export type PayoutDestination=BankDestination|UpiDestination;
const KEY_PATTERN=/^[A-Za-z0-9_-]{43}$/;
const RECORD_ID=/^[0-9a-f-]{36}$/i;
const version='v1';
function key():Buffer{
 const encoded=process.env.PIN_VAULT_KEY||'';
 if(!KEY_PATTERN.test(encoded))throw Error('Payout vault key is unavailable');
 const master=Buffer.from(encoded,'base64url');
 if(master.length!==32||master.toString('base64url')!==encoded)
  throw Error('Payout vault key is unavailable');
 return Buffer.from(hkdfSync('sha256',master,Buffer.alloc(0),
  Buffer.from('nisvartha:payout-destinations:v1','utf8'),32));
}
function associated(scope:DestinationScope,id:string):Buffer{
 if(!RECORD_ID.test(id))throw new TypeError('Invalid payout destination identity');
 return Buffer.from('nisvartha:'+scope+':'+version+':'+id,'utf8');
}
function decodeCanonical(input:string):Buffer{
 if(!/^[A-Za-z0-9_-]+$/.test(input))throw Error('Invalid payout destination');
 const value=Buffer.from(input,'base64url');
 if(value.toString('base64url')!==input)throw Error('Invalid payout destination');
 return value;
}
function valid(destination:unknown):destination is PayoutDestination{
 if(!destination||typeof destination!=='object')return false;
 const obj=destination as Record<string,unknown>;
 if(obj.method==='BANK')return Object.keys(obj).sort().join(',')===
  'accountNumber,holderName,ifsc,method'&&
  typeof obj.holderName==='string'&&/^[A-Za-z][A-Za-z .'-]{1,119}$/.test(obj.holderName)&&
  typeof obj.accountNumber==='string'&&/^[0-9]{6,18}$/.test(obj.accountNumber)&&
  typeof obj.ifsc==='string'&&/^[A-Z]{4}0[A-Z0-9]{6}$/.test(obj.ifsc);
 return obj.method==='UPI'&&Object.keys(obj).sort().join(',')==='method,upiId'&&
  typeof obj.upiId==='string'&&/^[A-Za-z0-9._-]{2,100}@[A-Za-z]{2,50}$/.test(obj.upiId);
}
export function sealPayoutDestination(scope:DestinationScope,id:string,destination:PayoutDestination):string{
 if(!valid(destination))throw new TypeError('Invalid payout destination');
 const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key(),iv);
 cipher.setAAD(associated(scope,id));
 const body=Buffer.concat([cipher.update(JSON.stringify(destination),'utf8'),cipher.final()]);
 return [version,iv.toString('base64url'),body.toString('base64url'),
  cipher.getAuthTag().toString('base64url')].join('.');
}
export function unsealPayoutDestination(scope:DestinationScope,id:string,sealed:string):PayoutDestination{
 const chunks=sealed.split('.');
 if(chunks.length!==4||chunks[0]!==version)throw Error('Invalid payout destination');
 const iv=decodeCanonical(chunks[1]),body=decodeCanonical(chunks[2]),tag=decodeCanonical(chunks[3]);
 if(iv.length!==12||body.length<1||body.length>700||tag.length!==16)
  throw Error('Invalid payout destination');
 const decipher=createDecipheriv('aes-256-gcm',key(),iv);
 decipher.setAAD(associated(scope,id));decipher.setAuthTag(tag);
 const value=Buffer.concat([decipher.update(body),decipher.final()]).toString('utf8');
 const parsed:unknown=JSON.parse(value);
 if(!valid(parsed))throw Error('Invalid payout destination');
 return parsed;
}
export function maskPayoutDestination(destination:PayoutDestination):string{
 return destination.method==='BANK'?'Bank ••••'+destination.accountNumber.slice(-4):
  'UPI ••••@'+destination.upiId.split('@')[1];
}
