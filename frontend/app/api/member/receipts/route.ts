import {NextResponse} from 'next/server';
import {memberFetch} from '@/lib/member-session';
export async function GET(request:Request){
 const search=new URL(request.url).searchParams;
 for(const key of search.keys())
  if(key!=='cursor'||search.getAll(key).length!==1)
   return NextResponse.json({message:'Invalid receipt query'},{status:400});
 const cursor=search.get('cursor');
 if(cursor!==null&&!/^[1-9][0-9]{0,9}$/.test(cursor))
  return NextResponse.json({message:'Invalid receipt cursor'},{status:400});
 const result=await memberFetch('receipts'+(cursor?'?cursor='+encodeURIComponent(cursor):''));
 return new NextResponse(await result.text(),{
  status:result.status,
  headers:{'Content-Type':'application/json','Cache-Control':'no-store'}
 });
}
