import {randomInt} from 'node:crypto';

const ALPHABET='ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
export const REFERRAL_CODE_PATTERN=/^[A-Z0-9]{8}$/;
export const LEGACY_REFERRAL_CODE_PATTERN=/^[A-Za-z0-9_-]{22}$/;

export function generateReferralCode():string{
 let result='';
 for(let index=0;index<8;index++)result+=ALPHABET[randomInt(ALPHABET.length)];
 return result;
}
export function normalizeReferralCode(value:string):string{
 const code=value.trim();
 return /^[A-Za-z0-9]{8}$/.test(code)?code.toUpperCase():code;
}
export function validReferralCode(value:string):boolean{
 return REFERRAL_CODE_PATTERN.test(value)||LEGACY_REFERRAL_CODE_PATTERN.test(value);
}
