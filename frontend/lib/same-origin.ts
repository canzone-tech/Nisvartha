export function enforceSameOrigin(request:Request):boolean{
 const origin=request.headers.get('origin');
 if(!origin)return false;
 try{
  const source=new URL(origin);
  const target=new URL(request.url);
  const inboundHost=(request.headers.get('host')||target.host).toLowerCase();
  const forwardedProto=request.headers.get('x-forwarded-proto');
  if(forwardedProto&&forwardedProto!== 'http'&&forwardedProto!=='https')return false;
  const expectedProtocol=(forwardedProto?forwardedProto+':':target.protocol);
  return (source.protocol==='https:'||source.protocol==='http:')&&
   source.host.toLowerCase()===inboundHost&&
   source.protocol===expectedProtocol;
 }catch{return false}
}
