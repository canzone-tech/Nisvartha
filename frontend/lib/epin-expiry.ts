/**
 * Convert a native datetime-local value (browser time zone) into the explicit
 * UTC ISO 8601 instant required by the staff-only E-PIN policy API.
 * Reject invalid dates and DST gaps/ambiguous repeated hours instead of
 * silently changing what the operator selected.
 */
export function localExpiryToUtcIso(value:string):string|null {
 const match=/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
 if(!match)return null;
 const date=new Date(value);
 if(!Number.isFinite(date.getTime()))return null;
 const [year,month,day,hour,minute]=match.slice(1).map(Number);
 const sameLocal=(candidate:Date)=>candidate.getFullYear()===year &&
  candidate.getMonth()+1===month && candidate.getDate()===day &&
  candidate.getHours()===hour && candidate.getMinutes()===minute;
 if(!sameLocal(date))return null;
 // When clocks fall back, the same wall-clock time has two UTC instants.
 const anHourLater=new Date(date.getTime()+60*60*1000);
 if(sameLocal(anHourLater)&&anHourLater.getTimezoneOffset()!==date.getTimezoneOffset())return null;
 return date.toISOString();
}
