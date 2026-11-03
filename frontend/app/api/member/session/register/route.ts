import {NextResponse} from 'next/server';
import {apiInternalUrl} from '@/lib/staff-session';
import {enforceSameOrigin,memberApplicationsEnabled} from '@/lib/member-session';
export async function POST(req:Request){
 if(!memberApplicationsEnabled())return NextResponse.json({message:'Applications not enabled'},{status:404});
 if(!enforceSameOrigin(req))return NextResponse.json({message:'Origin denied'},{status:403});
 let data:unknown;try{data=await req.json()}catch{return NextResponse.json({message:'Invalid JSON'},{status:400})}
 const result=await fetch(apiInternalUrl()+'/api/v1/members/register',{
  method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data),cache:'no-store'
 });
 return new NextResponse(await result.text(),{status:result.status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
}
