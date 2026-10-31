import {NextResponse} from 'next/server';
import {enforceSameOrigin,staffFetch} from '@/lib/staff-session';
type Props={params:Promise<{path:string[]}>};
function allowed(p:string){
 return /^cms\/(?:contents(?:\/[0-9a-f-]{36}(?:\/(?:revisions|archive))?)?|revisions\/[0-9a-f-]{36}\/(?:submit|approve|reject)|dashboard|audit)$/.test(p)
 ||/^cms\/enquiries(?:\/export|\/retention\/run|\/[0-9a-f-]{36}(?:\/(?:assign|status|notes|legal-hold))?)?$/.test(p)
 ||/^staff\/(?:accounts(?:\/[0-9a-f-]{36})?|me)$/.test(p);
}
async function proxy(req:Request,params:Props['params'],method:'GET'|'POST'|'PATCH'){
 const {path}=await params;const target=path.join('/');
 if(!allowed(target))return NextResponse.json({message:'Not found'},{status:404});
 if(method!=='GET'&&!enforceSameOrigin(req))return NextResponse.json({message:'Request origin rejected'},{status:403});
 let body:string|undefined;
 if(method!=='GET'){
  body=await req.text();
  if(body.length>25000)return NextResponse.json({message:'Request too large'},{status:413});
 }
 const result=await staffFetch(target,{method,headers:{...(body?{'Content-Type':'application/json'}:{})},...(body===undefined?{}:{body})});
 const contentType=result.headers.get('content-type')||'application/json';
 return new NextResponse(await result.text(),{status:result.status,headers:{'Content-Type':contentType,'Cache-Control':'no-store'}});
}
export async function GET(req:Request,{params}:Props){return proxy(req,params,'GET')}
export async function POST(req:Request,{params}:Props){return proxy(req,params,'POST')}
export async function PATCH(req:Request,{params}:Props){return proxy(req,params,'PATCH')}
