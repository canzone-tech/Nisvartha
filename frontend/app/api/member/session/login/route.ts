import {NextResponse} from 'next/server';
import {apiInternalUrl} from '@/lib/staff-session';
import {enforceSameOrigin,MEMBER_COOKIE,memberCookieOptions,memberUiEnabled} from '@/lib/member-session';
export async function POST(req:Request){
 if(!memberUiEnabled())return NextResponse.json({message:'Member portal disabled'},{status:404});
 if(!enforceSameOrigin(req))return NextResponse.json({message:'Origin denied'},{status:403});
 let data:unknown;try{data=await req.json()}catch{return NextResponse.json({message:'Invalid JSON'},{status:400})}
 const result=await fetch(apiInternalUrl()+'/api/v1/members/login',{
  method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data),cache:'no-store'
 });
 if(!result.ok)return NextResponse.json({message:'Invalid credentials'},{status:result.status});
 const session=await result.json() as {accessToken:string;member:{id:string;displayName:string;status:string}};
 if(!session.accessToken)return NextResponse.json({message:'Session unavailable'},{status:502});
 const response=NextResponse.json({member:session.member});
 response.cookies.set(MEMBER_COOKIE,session.accessToken,memberCookieOptions);
 return response;
}
