import {ServiceUnavailableException} from '@nestjs/common';
import {hashOpaqueCredential} from '../security/opaque-credential';

export const uatPinRequested=()=>process.env.NISVARTHA_UAT_PIN_REGISTRATION==='synthetic';
/** Synthetic credentials must never work against a real/production database. */
export function assertUatPinEnvironment(){
 let isolated=false;
 try{
  const url=new URL(process.env.DATABASE_URL||'');
  isolated=url.protocol==='mysql:'&&url.pathname==='/nisvartha_ci'&&
   ['127.0.0.1','localhost'].includes(url.hostname);
 }catch{}
 if(!uatPinRequested()||process.env.NODE_ENV==='production'||!isolated||
    process.env.MEMBER_PORTAL_ENABLED!=='true'||
    process.env.MEMBER_APPLICATIONS_ENABLED!=='true')
  throw new ServiceUnavailableException('Synthetic registration PIN UAT is unavailable');
}
export const uatPinHash=(secret:string)=>hashOpaqueCredential('uat-signup',secret);
