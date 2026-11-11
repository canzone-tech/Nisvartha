/** Strict read-only guard for explicitly confirmed, unused installation DBs.
 * Used ONLY to omit a backup reference when there is no business data to lose.
 * All MySQL tables are discovered from information_schema; counts use typed
 * Prisma model delegates, never dynamically interpolated SQL identifiers.
 */
const SEED_TABLES=new Set([
 '_prisma_migrations','staff_users','staff_sessions','cms_audit','matrix_state'
]);

export async function inspectUnusedDatabase(db,prismaModelMetadata){
 if(!Array.isArray(prismaModelMetadata)||prismaModelMetadata.length<25)
  return ['Generated Prisma database model metadata is unavailable'];
 const map=new Map(prismaModelMetadata.map(m=>[m.dbName??m.name,m.name]));
 const rows=await db.$queryRaw`
  SELECT TABLE_NAME AS tableName FROM information_schema.TABLES
  WHERE TABLE_SCHEMA=DATABASE() AND TABLE_TYPE='BASE TABLE'`;
 if(!Array.isArray(rows)||!rows.some(row=>row.tableName==='_prisma_migrations'))
  return ['Migration history table missing: not an existing initialized database'];
 const problems=[];
 for(const {tableName} of rows){
  if(SEED_TABLES.has(tableName))continue;
  const model=map.get(tableName);
  if(!model){
   problems.push('Unexpected existing table '+tableName);
   continue;
  }
  const delegate=db[model[0].toLowerCase()+model.slice(1)];
  if(!delegate||typeof delegate.count!=='function'){
   problems.push('No safe authoritative read delegate for '+tableName);
   continue;
  }
  const count=await delegate.count();
  if(!Number.isSafeInteger(count)||count<0)
   problems.push('Invalid table row count for '+tableName);
  else if(count>0)problems.push('Existing application records in '+tableName);
 }
 return problems;
}
