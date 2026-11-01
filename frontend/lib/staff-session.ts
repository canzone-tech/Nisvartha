import {cookies} from 'next/headers';
export const STAFF_COOKIE='nisvartha_staff_access';
export const apiInternalUrl=()=>process.env.API_INTERNAL_URL||'http://127.0.0.1:3100';
export function enforceSameOrigin(request:Request):boolean{
 const origin=request.headers.get('origin');
 if(!origin)return false;
 try{
  const source=new URL(origin);
  const target=new URL(request.url);
  // Next.js may normalize the internal Request URL to localhost while the
  // actual HTTP Host remains 127.0.0.1 (or the externally configured host).
  // Compare the browser's Origin to the inbound Host, never to a proxy alias.
  const inboundHost=request.headers.get('host')||target.host;
  return (source.protocol==='https:'||source.protocol==='http:') &&
   source.host.toLowerCase()===inboundHost.toLowerCase() &&
   source.protocol===target.protocol;
 }catch{return false;}
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
