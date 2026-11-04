/** Synthetic policies must never enable actions on a real database. */
export function isDisposableUatDatabase():boolean{
 try{
  const u=new URL(process.env.DATABASE_URL||'');
  return process.env.NODE_ENV!=='production'&&u.protocol==='mysql:'&&
   ['127.0.0.1','localhost'].includes(u.hostname)&&u.pathname==='/nisvartha_ci';
 }catch{return false}
}
