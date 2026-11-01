import {NextResponse} from 'next/server';
import {enforceSameOrigin,memberFetch} from '@/lib/member-session';
const endpoints={profile:{path:'profile',method:'PATCH'},password:{path:'password',method:'POST'},withdraw:{path:'application/withdraw',method:'POST'}} as const;
export async function POST(req:Request,{params}:{params:Promise<{action:string}>}){
 if(!enforceSameOrigin(req))return NextResponse.json({message:'Origin denied'},{status:403});
 const {action}=await params;
 if(!(action in endpoints))return NextResponse.json({message:'Not found'},{status:404});
 const endpoint=endpoints[action as keyof typeof endpoints];
 const body=await req.text();
 if(body.length>4096)return NextResponse.json({message:'Request too large'},{status:413});
 const upstream=await memberFetch(endpoint.path,{method:endpoint.method,
  headers:{'Content-Type':'application/json'},body:body||'{}'
 });
 return new NextResponse(await upstream.text(),{status:upstream.status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
}
