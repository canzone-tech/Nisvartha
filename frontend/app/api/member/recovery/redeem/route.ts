import {NextResponse} from 'next/server';
import {apiInternalUrl} from '@/lib/staff-session';
import {enforceSameOrigin,memberUiEnabled} from '@/lib/member-session';
export async function POST(req:Request){
 if(!memberUiEnabled()||process.env.MEMBER_RECOVERY_ENABLED!=='true')return NextResponse.json({message:'Recovery unavailable'},{status:404});
 if(!enforceSameOrigin(req))return NextResponse.json({message:'Request origin rejected'},{status:403});
 const raw=await req.text();
 if(raw.length>2048)return NextResponse.json({message:'Request too large'},{status:413});
 let body;try{body=JSON.parse(raw)}catch{return NextResponse.json({message:'Invalid request'},{status:400})}
 const result=await fetch(apiInternalUrl()+'/api/v1/members/recovery/redeem',{
  method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),cache:'no-store'
 });
 return new NextResponse(await result.text(),{status:result.status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
}
