import {ServiceUnavailableException} from '@nestjs/common';
import {hashOpaqueCredential} from '../security/opaque-credential';

/** Real registration E-PIN evidence is separate from synthetic/UAT tokens and offline transaction settlement. */
export const registrationPinEnabled=()=>process.env.REGISTRATION_ACCESS_PIN_ENABLED==='true';
export function assertRegistrationPinEnvironment(){
 if(!registrationPinEnabled()||
    process.env.NISVARTHA_UAT_PIN_REGISTRATION==='synthetic'||
    process.env.MEMBER_PORTAL_ENABLED!=='true'||
    process.env.MEMBER_APPLICATIONS_ENABLED!=='true'||
    !process.env.MEMBER_TERMS_VERSION||!process.env.MEMBER_PRIVACY_VERSION)
  throw new ServiceUnavailableException('Registration E-PINs are not enabled');
}
export const registrationPinHash=(secret:string)=>hashOpaqueCredential('registration-access',secret);
