import {createCipheriv,createDecipheriv,randomBytes} from 'node:crypto';

/**
 * Restore Admin access to user-requested registration codes without storing plaintext.
 * The SHA-256 credential digest remains authoritative for one-time redemption.
 * The external PIN_VAULT_KEY must be backed up independently from MySQL.
 */
export type PinPurpose='registration-access'|'uat-signup';
const KEY_PATTERN=/^[A-Za-z0-9_-]{43}$/;
const PIN_PATTERN=/^[A-Za-z0-9_-]{43}$/;
const ID_PATTERN=/^[0-9a-f-]{36}$/i;
const VERSION='v1';
function key():Buffer{
 const raw=process.env.PIN_VAULT_KEY||'';
 if(!KEY_PATTERN.test(raw))throw Error('PIN vault key is unavailable');
 const decoded=Buffer.from(raw,'base64url');
 if(decoded.length!==32||decoded.toString('base64url')!==raw)
  throw Error('PIN vault key is unavailable');
 return decoded;
}
function associatedData(purpose:PinPurpose,id:string):Buffer{
 if(!ID_PATTERN.test(id))throw new TypeError('Invalid PIN record identity');
 return Buffer.from('nisvartha:'+purpose+':'+VERSION+':'+id,'utf8');
}
export function sealRegistrationCode(purpose:PinPurpose,id:string,code:string):string{
 if(!PIN_PATTERN.test(code))throw new TypeError('Invalid registration code');
 const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key(),iv);
 cipher.setAAD(associatedData(purpose,id));
 const encrypted=Buffer.concat([cipher.update(code,'utf8'),cipher.final()]);
 return [VERSION,iv.toString('base64url'),encrypted.toString('base64url'),
  cipher.getAuthTag().toString('base64url')].join('.');
}
export function unsealRegistrationCode(purpose:PinPurpose,id:string,sealed:string):string{
 const pieces=sealed.split('.');
 if(pieces.length!==4||pieces[0]!==VERSION||!pieces.slice(1).every(x=>/^[A-Za-z0-9_-]+$/.test(x)))
  throw Error('PIN vault record is invalid');
 // Reject alternate/non-canonical base64url spellings even when they decode
 // to the same ciphertext bytes. Integrity includes the serialized payload.
 const decodeCanonical=(segment:string)=>{
  const bytes=Buffer.from(segment,'base64url');
  if(bytes.toString('base64url')!==segment)throw Error('PIN vault record is invalid');
  return bytes;
 };
 const iv=decodeCanonical(pieces[1]);
 const data=decodeCanonical(pieces[2]);
 const tag=decodeCanonical(pieces[3]);
 if(iv.length!==12||tag.length!==16||data.length!==43)
  throw Error('PIN vault record is invalid');
 const decipher=createDecipheriv('aes-256-gcm',key(),iv);
 decipher.setAAD(associatedData(purpose,id));
 decipher.setAuthTag(tag);
 const code=Buffer.concat([decipher.update(data),decipher.final()]).toString('utf8');
 if(!PIN_PATTERN.test(code))throw Error('PIN vault record is invalid');
 return code;
}
