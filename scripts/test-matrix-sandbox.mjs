import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
const require=createRequire(new URL('../backend/package.json',import.meta.url));
const {FLYER_MATRIX_REFERENCE,MAX_PREVIEW_POSITIONS,simulateMatrixPlacement,
 validateMatrixPreviewPolicy}=require('../backend/dist/security/matrix-simulation.js');
const flyer=JSON.parse(readFileSync(new URL('../docs/flyer-reference.json',import.meta.url)));
assert.equal(FLYER_MATRIX_REFERENCE.width,flyer.matrixWidth);
assert.equal(FLYER_MATRIX_REFERENCE.levels,flyer.matrixLevels);
assert.equal(FLYER_MATRIX_REFERENCE.joiningAmountINR,flyer.joiningAmountINR);
assert.equal(FLYER_MATRIX_REFERENCE.directReferralINR,flyer.directReferralINR);
assert.deepEqual([...FLYER_MATRIX_REFERENCE.levelPayoutsINR],flyer.levels.map(x=>x.displayedLevelPayoutINR));
assert.equal(FLYER_MATRIX_REFERENCE.rebirthAtLevel4,flyer.levels[3].rebirthIds);
assert.equal(FLYER_MATRIX_REFERENCE.rebirthAtLevel5,flyer.levels[4].rebirthIds);
assert.equal(MAX_PREVIEW_POSITIONS,flyer.flyerTotalSlots);
const base={entrants:0,rebirthAtLevel4:1,rebirthAtLevel5:3,rebirthLimit:4,rebirthEnabled:true};
const zero=simulateMatrixPlacement(base);
assert.equal(zero.placed,0);
assert.deepEqual(zero.levels.map(x=>x.capacity),[3,9,27,81,243]);
assert.equal(zero.rebirthCandidates.length,0);
assert.equal(zero.positions.length,1);
assert.equal(zero.positions[0].id,'SIM-ROOT');
for(const [entrants,completed] of [[3,1],[12,2],[39,3],[120,4],[363,5]]){
 const p=simulateMatrixPlacement({...base,entrants});
 assert.deepEqual(p.levels.filter(x=>x.complete).map(x=>x.level),
  Array.from({length:completed},(_,i)=>i+1));
 assert.equal(p.placed,entrants);
 assert.equal(p.placed+p.unfilled,363);
 assert.equal(p.canCredit,false);
 assert.equal(p.canIssueRebirth,false);
 assert.equal(p.canAcceptPayment,false);
}
const a=simulateMatrixPlacement({...base,entrants:120});
assert.deepEqual(a.rebirthCandidates,[{
 level:4,count:1,threshold:120,status:'NOT_ISSUED'
}]);
const complete=simulateMatrixPlacement({...base,entrants:363});
assert.deepEqual(complete.rebirthCandidates.map(x=>[x.level,x.count,x.threshold]),
 [[4,1,120],[5,3,363]]);
assert.equal(complete.displayTruncated,true);
assert.equal(complete.positions.length,151);
const first=simulateMatrixPlacement({...base,entrants:18});
assert.deepEqual(first.positions.slice(1,7).map(x=>[x.parentId,x.level,x.slot]),[
 ['SIM-ROOT',1,1],['SIM-ROOT',1,2],['SIM-ROOT',1,3],
 ['SIM-0001',2,1],['SIM-0001',2,2],['SIM-0001',2,3]
]);
assert.deepEqual(simulateMatrixPlacement({...base,entrants:18}),first,
 'BFS placement must be stable on retries');
assert.deepEqual(simulateMatrixPlacement({...base,entrants:363,
 rebirthEnabled:false}).rebirthCandidates,[]);
assert.deepEqual(simulateMatrixPlacement({...base,entrants:363,
 rebirthAtLevel4:0,rebirthAtLevel5:2,rebirthLimit:2}).rebirthCandidates
 .map(x=>x.count),[2]);
for(const bad of [
 {...base,entrants:364},{...base,entrants:-1},
 {...base,rebirthAtLevel4:5,rebirthLimit:4},
 {...base,rebirthAtLevel5:1.5},{...base,rebirthEnabled:'true'},
 {...base,rebirthLimit:Infinity},{...base,unexpected:'paid'},
 {...base,rebirthLimit:0},null
])assert.throws(()=>validateMatrixPreviewPolicy(bad),'Unsafe draft policy accepted');
const core=readFileSync(new URL('../backend/src/security/matrix-simulation.ts',import.meta.url),'utf8');
assert.doesNotMatch(core,/@prisma|\\.\\$transaction|\\.create\\(|\\.update\\(|fetch\\(/,
 'Pure simulator gained an external side effect');
const controller=readFileSync(new URL('../backend/src/staff/matrix-preview.controller.ts',import.meta.url),'utf8');
assert.match(controller,/isDisposableUatDatabase/);
assert.match(controller,/@StaffRoles\\(StaffRole.ADMIN,StaffRole.SUPER_ADMIN\\)/);
assert.doesNotMatch(controller,/memberAccount\\.(create|update)|memberInvitation\\.(create|update)|memberWallet/,
 'Policy preview can never mutate member/financial state');
console.log('Flyer reference parity, 1:3 BFS, 5 levels, rebirth configuration, caps, retry determinism and zero financial side effects: PASS');
