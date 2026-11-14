import {NextResponse} from 'next/server';
import {apiInternalUrl,enforceSameOrigin,STAFF_COOKIE,staffCookieOptions,staffToken} from '@/lib/staff-session';
export async function POST(req:Request){
 if(!enforceSameOrigin(req))return NextResponse.json({message:'Request origin rejected'},
  {status:403,headers:{'Cache-Control':'no-store'}});
 const token=await staffToken();
 if(!token)return NextResponse.json({message:'Not signed in'},
  {status:401,headers:{'Cache-Control':'no-store'}});
 let body:unknown;
 try{body=await req.json()}catch{
  return NextResponse.json({message:'Invalid request'},
   {status:400,headers:{'Cache-Control':'no-store'}});
 }
 const backend=await fetch(apiInternalUrl()+'/api/v1/staff/password',{
  method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},
  body:JSON.stringify(body),cache:'no-store'
 });
 if(!backend.ok)return NextResponse.json({message:'Password change rejected'},
  {status:backend.status,headers:{'Cache-Control':'no-store'}});
 const res=NextResponse.json({sessionsRevoked:true},
  {headers:{'Cache-Control':'no-store'}});
 res.cookies.set(STAFF_COOKIE,'',{...staffCookieOptions,maxAge:0});
 return res;
}
