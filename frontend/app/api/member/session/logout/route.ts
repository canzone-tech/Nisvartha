import {NextResponse} from 'next/server';
import {apiInternalUrl} from '@/lib/staff-session';
import {enforceSameOrigin,MEMBER_COOKIE,memberCookieOptions,memberToken} from '@/lib/member-session';
export async function POST(req:Request){
 if(!enforceSameOrigin(req))return NextResponse.json({message:'Origin denied'},{status:403});
 const token=await memberToken();
 if(token)try{await fetch(apiInternalUrl()+'/api/v1/members/logout',{
  method:'POST',headers:{Authorization:'Bearer '+token},cache:'no-store'
 });}catch{}
 const response=NextResponse.json({revoked:true});
 response.cookies.set(MEMBER_COOKIE,'',{...memberCookieOptions,maxAge:0});
 return response;
}
