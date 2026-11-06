/**
 * Deterministic, non-operational modelling of the owner-supplied flyer.
 * ZERO persistence, member identity, payable credit, PIN creation or rebirth
 * account creation is permitted here. This cannot decide legal eligibility.
 */
export const FLYER_MATRIX_REFERENCE={
 width:3,levels:5,joiningAmountINR:15000,directReferralINR:1000,
 levelPayoutsINR:[2500,5000,10000,50000,90000],
 rebirthAtLevel4:1,rebirthAtLevel5:3,source:'OWNER_CONFIRMED_FLYER'
} as const;
export const MAX_PREVIEW_POSITIONS=363;
export const MAX_RENDERED_POSITIONS=150;
export type MatrixPreviewPolicy={
 entrants:number;
 rebirthAtLevel4:number;
 rebirthAtLevel5:number;
 rebirthLimit:number;
 rebirthEnabled:boolean;
};
export type MatrixPosition={
 id:string;parentId:string|null;slot:number;level:number;sequence:number;
};
export type MatrixPreview={
 status:'SIMULATION_ONLY';canCredit:false;canIssueRebirth:false;canAcceptPayment:false;
 config:MatrixPreviewPolicy;capacity:number;placed:number;unfilled:number;
 levels:{level:number;capacity:number;filled:number;complete:boolean}[];
 rebirthCandidates:{level:4|5;count:number;threshold:number;status:'NOT_ISSUED'}[];
 positions:MatrixPosition[];displayTruncated:boolean;
 ruleAssumption:'FULL_LEVEL_COMPLETION_UNVERIFIED';
};

export function validateMatrixPreviewPolicy(value:unknown):MatrixPreviewPolicy{
 if(!value||typeof value!=='object'||Array.isArray(value))
  throw new TypeError('Matrix preview policy must be an object');
 const input=value as Record<string,unknown>;
 const keys=['entrants','rebirthAtLevel4','rebirthAtLevel5','rebirthLimit','rebirthEnabled'];
 if(Object.keys(input).some(key=>!keys.includes(key)))
  throw new TypeError('Unexpected matrix policy field');
 const bounded=(key:string,min:number,max:number):number=>{
  const n=input[key];
  if(typeof n!=='number'||!Number.isSafeInteger(n)||n<min||n>max)
   throw new RangeError('Invalid '+key);
  return n;
 };
 const entrants=bounded('entrants',0,MAX_PREVIEW_POSITIONS);
 const rebirthAtLevel4=bounded('rebirthAtLevel4',0,16);
 const rebirthAtLevel5=bounded('rebirthAtLevel5',0,16);
 const rebirthLimit=bounded('rebirthLimit',0,16);
 if(typeof input.rebirthEnabled!=='boolean')
  throw new TypeError('Invalid rebirthEnabled');
 if(rebirthAtLevel4+rebirthAtLevel5>rebirthLimit)
  throw new RangeError('Rebirth candidate counts exceed configured cap');
 return {entrants,rebirthAtLevel4,rebirthAtLevel5,rebirthLimit,
  rebirthEnabled:input.rebirthEnabled};
}

export function simulateMatrixPlacement(input:unknown):MatrixPreview{
 const config=validateMatrixPreviewPolicy(input);
 const all:MatrixPosition[]=[{id:'SIM-ROOT',parentId:null,level:0,slot:0,sequence:0}];
 const filled=[0,0,0,0,0,0],width=FLYER_MATRIX_REFERENCE.width;
 for(let i=1;i<=config.entrants;i++){
  const parent=all[Math.floor((i-1)/width)];
  if(!parent)throw new Error('Preview parent missing');
  const level=parent.level+1;
  if(level>FLYER_MATRIX_REFERENCE.levels)
   throw new RangeError('Simulation exceeds five-level reference');
  all.push({id:'SIM-'+String(i).padStart(4,'0'),parentId:parent.id,
   slot:(i-1)%width+1,level,sequence:i});
  filled[level]++;
 }
 let cumulative=0;
 const levels=Array.from({length:FLYER_MATRIX_REFERENCE.levels},(_,j)=>{
  const level=j+1,capacity=width**level;
  cumulative+=capacity;
  return {level,capacity,filled:filled[level],
   complete:config.entrants>=cumulative};
 });
 const rebirthCandidates:MatrixPreview['rebirthCandidates']=[];
 if(config.rebirthEnabled){
  for(const [level,count] of [[4,config.rebirthAtLevel4],
   [5,config.rebirthAtLevel5]] as const){
   if(levels[level-1].complete&&count>0)
    rebirthCandidates.push({
     level,count,threshold:levels.slice(0,level).reduce((sum,x)=>sum+x.capacity,0),
     status:'NOT_ISSUED'
    });
  }
 }
 return {
  status:'SIMULATION_ONLY',canCredit:false,canIssueRebirth:false,canAcceptPayment:false,
  config,capacity:MAX_PREVIEW_POSITIONS,placed:config.entrants,
  unfilled:MAX_PREVIEW_POSITIONS-config.entrants,levels,rebirthCandidates,
  positions:all.slice(0,MAX_RENDERED_POSITIONS+1),
  displayTruncated:all.length>MAX_RENDERED_POSITIONS+1,
  ruleAssumption:'FULL_LEVEL_COMPLETION_UNVERIFIED'
 };
}
