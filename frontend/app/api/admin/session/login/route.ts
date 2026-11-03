import {NextResponse} from 'next/server';
import {apiInternalUrl,enforceSameOrigin,STAFF_COOKIE,staffCookieOptions} from '@/lib/staff-session';
export async function POST(req:Request){
 if(!enforceSameOrigin(req))return NextResponse.json({message:'Request origin rejected'},{status:403});
 let data:unknown;try{data=await req.json()}catch{return NextResponse.json({message:'Invalid request'},{status:400})}
 const backend=await fetch(apiInternalUrl()+'/api/v1/staff/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data),cache:'no-store'});
 if(!backend.ok)return NextResponse.json({message:'Login failed'},{status:backend.status});
 const result=await backend.json() as {accessToken:string;user:{id:string;email:string;role:string}};
 if(!result.accessToken)return NextResponse.json({message:'Authentication unavailable'},{status:502});
 const res=NextResponse.json({user:result.user});
 res.cookies.set(STAFF_COOKIE,result.accessToken,staffCookieOptions);
 return res;
}
