import {ServiceUnavailableException} from '@nestjs/common';
import {hashOpaqueCredential} from '../security/opaque-credential';
import {isDisposableUatDatabase} from '../security/disposable-uat';

export const uatPinRequested=()=>process.env.NISVARTHA_UAT_PIN_REGISTRATION==='synthetic';
export function assertUatPinEnvironment(){
 if(!uatPinRequested()||!isDisposableUatDatabase()||
    process.env.MEMBER_PORTAL_ENABLED!=='true'||
    process.env.MEMBER_APPLICATIONS_ENABLED!=='true')
  throw new ServiceUnavailableException('Synthetic registration PIN UAT is unavailable');
}
export const uatPinHash=(secret:string)=>hashOpaqueCredential('uat-signup',secret);
