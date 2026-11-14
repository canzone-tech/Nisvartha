import {cookies} from 'next/headers';
import {apiInternalUrl,enforceSameOrigin} from './staff-session';
export {enforceSameOrigin};
export const MEMBER_COOKIE='nisvartha_member_access';
export const memberUiEnabled=()=>process.env.MEMBER_PORTAL_ENABLED==='true';
export const memberApplicationsEnabled=()=>memberUiEnabled()&&process.env.MEMBER_APPLICATIONS_ENABLED==='true';
export const publicRegistrationEnabled=()=>memberApplicationsEnabled()&&process.env.MEMBER_PUBLIC_REGISTRATION_ENABLED==='true';
export const memberCookieOptions={httpOnly:true,sameSite:'strict' as const,secure:process.env.NODE_ENV==='production',path:'/',maxAge:8*60*60};
export async function memberToken(){return (await cookies()).get(MEMBER_COOKIE)?.value||null}
export async function memberFetch(path:string,init:RequestInit={}){
 if(!memberUiEnabled())return new Response(null,{status:404});
 const token=await memberToken();
 if(!token)return new Response(null,{status:401});
 return fetch(apiInternalUrl()+'/api/v1/members/'+path,{
  ...init,headers:{...Object.fromEntries(new Headers(init.headers)),Authorization:'Bearer '+token},
  cache:'no-store'
 });
}
