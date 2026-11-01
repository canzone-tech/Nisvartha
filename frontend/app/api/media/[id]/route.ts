import {cmsPublicEnabled} from '@/lib/cms-public';
export const runtime='nodejs';
export async function GET(_req:Request,{params}:{params:Promise<{id:string}>}){
 if(!cmsPublicEnabled)return new Response('Not found',{status:404});
 const {id}=await params;
 if(!/^[0-9a-f-]{36}$/.test(id))return new Response('Not found',{status:404});
 const api=process.env.API_INTERNAL_URL||'http://127.0.0.1:3100';
 const response=await fetch(api+'/api/v1/public/media/'+id,{cache:'no-store'});
 if(!response.ok||!response.body)return new Response('Not found',{status:404});
 return new Response(response.body,{
  status:200,headers:{'Content-Type':'image/webp','X-Content-Type-Options':'nosniff','Cache-Control':'no-store'}
 });
}
