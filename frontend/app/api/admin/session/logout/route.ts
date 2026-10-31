import {NextResponse} from 'next/server';
import {apiInternalUrl,enforceSameOrigin,STAFF_COOKIE,staffCookieOptions,staffToken} from '@/lib/staff-session';
export async function POST(req:Request){
 if(!enforceSameOrigin(req))return NextResponse.json({message:'Request origin rejected'},{status:403});
 const token=await staffToken();
 if(token)try{await fetch(apiInternalUrl()+'/api/v1/staff/logout',{method:'POST',headers:{Authorization:'Bearer '+token},cache:'no-store'});}catch{}
 const res=NextResponse.json({signedOut:true});
 res.cookies.set(STAFF_COOKIE,'',{...staffCookieOptions,maxAge:0});
 return res;
}
