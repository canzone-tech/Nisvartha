import {NextResponse} from 'next/server';
import {enforceSameOrigin,staffFetch} from '@/lib/staff-session';
type Props={params:Promise<{path:string[]}>};
function allowed(p:string){
 return /^cms\/(?:contents(?:\/[0-9a-f-]{36}(?:\/(?:revisions|archive))?)?|revisions\/[0-9a-f-]{36}\/(?:submit|approve|reject)|dashboard|audit)$/.test(p)
 ||/^cms\/media(?:\/upload|\/[0-9a-f-]{36}\/(?:submit|approve|reject|archive))?$/.test(p)
 ||/^cms\/membership\/recovery\/[0-9a-f-]{36}\/issue$/.test(p)
 ||/^cms\/membership\/(?:uat-pins|registration-pins)$/.test(p)
||/^cms\/membership\/applications(?:\/register|\/page|\/[0-9a-f-]{36}\/(?:review|decide|history))?$/.test(p)
||/^cms\/membership\/genealogy\/[0-9a-f-]{36}$/.test(p)
||/^cms\/membership\/uat-scenario\/[0-9a-f-]{36}(?:\/record)?$/.test(p)
||/^cms\/enquiries(?:\/export|\/retention\/run|\/[0-9a-f-]{36}(?:\/(?:assign|status|notes|legal-hold))?)?$/.test(p)
 ||/^staff\/donations(?:\/[0-9a-f-]{36}(?:\/reconcile|\/refunds(?:\/[0-9a-f-]{36}\/reconcile)?)?)?$/.test(p)
 ||/^staff\/epin-batches\/validate$/.test(p)
 ||/^staff\/epin-batches\/history$/.test(p)
 ||/^staff\/matrix-preview\/(?:defaults|simulate)$/.test(p)
 ||/^staff\/matrix-preview\/policies(?:\/[0-9]+\/(?:submit|review))?$/.test(p)
 ||/^staff\/(?:accounts(?:\/[0-9a-f-]{36})?|me|overview)$/.test(p);
}
async function proxy(req:Request,params:Props['params'],method:'GET'|'POST'|'PATCH'){
 const {path}=await params;const target=path.join('/');
 // No browser-facing path may create additional administrators.
 if(target==='staff/accounts'&&method==='POST')return NextResponse.json({message:'Not found'},{status:404});
 if(!allowed(target))return NextResponse.json({message:'Not found'},{status:404});
 if(method!=='GET'&&!enforceSameOrigin(req))return NextResponse.json({message:'Request origin rejected'},{status:403});
 let body:string|undefined;
 if(method!=='GET'){
  body=await req.text();
  if(body.length>25000)return NextResponse.json({message:'Request too large'},{status:413});
 }
 // Only explicitly documented list endpoints may receive query strings.
 // Unknown keys and duplicate keys must fail closed instead of being dropped.
 const parameters=new URL(req.url).searchParams;
 const allowedQueryKeys=target==='staff/donations'&&method==='GET'?['status','cursor']:
  target==='cms/membership/applications/page'
  ?['status','cursor','limit']:
  (target==='cms/membership/uat-pins'||target==='cms/membership/registration-pins')&&method==='GET'?['status','cursor']:[];
 for(const key of parameters.keys()){
  if(!allowedQueryKeys.includes(key)||parameters.getAll(key).length!==1)
   return NextResponse.json({message:'Invalid admin query'},{status:400});
 }
 const query=parameters.size?'?'+parameters.toString():'';
 const result=await staffFetch(target+query,{method,headers:{...(body?{'Content-Type':'application/json'}:{})},...(body===undefined?{}:{body})});
 const contentType=result.headers.get('content-type')||'application/json';
 return new NextResponse(await result.text(),{status:result.status,headers:{'Content-Type':contentType,'Cache-Control':'no-store'}});
}
export async function GET(req:Request,{params}:Props){return proxy(req,params,'GET')}
export async function POST(req:Request,{params}:Props){return proxy(req,params,'POST')}
export async function PATCH(req:Request,{params}:Props){return proxy(req,params,'PATCH')}
