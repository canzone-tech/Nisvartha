import {NextResponse} from 'next/server';
import {enforceSameOrigin,staffFetch} from '@/lib/staff-session';
export const runtime='nodejs';
export async function POST(req:Request){
 if(!enforceSameOrigin(req))return NextResponse.json({message:'Request origin rejected'},{status:403});
 const max=5*1024*1024+16*1024;
 const length=Number(req.headers.get('content-length'));
 if(Number.isFinite(length)&&length>max)return NextResponse.json({message:'Image too large'},{status:413});
 let data:FormData;
 try{data=await req.formData();}catch{return NextResponse.json({message:'Invalid image submission'},{status:400});}
 const image=data.get('file');
 if(!(image instanceof File)||image.size<1||image.size>5*1024*1024)
  return NextResponse.json({message:'Image must be 5 MB or smaller'},{status:413});
 const response=await staffFetch('cms/media/upload',{method:'POST',body:data});
 return new NextResponse(await response.text(),{status:response.status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
}
