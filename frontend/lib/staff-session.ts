import {cookies} from 'next/headers';
export const STAFF_COOKIE='nisvartha_staff_access';
export const apiInternalUrl=()=>process.env.API_INTERNAL_URL||'http://127.0.0.1:3100';
export function enforceSameOrigin(request:Request):boolean{
 const origin=request.headers.get('origin');
 if(!origin)return false;
 try{return new URL(origin).origin===new URL(request.url).origin;}catch{return false;}
}
export async function staffToken(){return (await cookies()).get(STAFF_COOKIE)?.value||null}
export async function staffFetch(path:string,init:RequestInit={}){
 const token=await staffToken();
 if(!token)return new Response(null,{status:401});
 return fetch(apiInternalUrl()+'/api/v1/'+path,{
  ...init,headers:{...Object.fromEntries(new Headers(init.headers)),Authorization:'Bearer '+token},
  cache:'no-store'
 });
}
export const staffCookieOptions={httpOnly:true,sameSite:'strict' as const,secure:process.env.NODE_ENV==='production',path:'/',maxAge:8*60*60};
