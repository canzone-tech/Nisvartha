import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {readFileSync} from 'node:fs';

// Run the production TS conversion with explicit process TZ fixtures.
// Node 22 supports native type stripping; no third-party runtime dependency.
const sourceUrl=new URL('../frontend/lib/epin-expiry.ts',import.meta.url).href;
const cases=[
 {
  "tz": "Asia/Kolkata",
  "values": [
   [
    "2027-01-31T23:59",
    "2027-01-31T18:29:00.000Z"
   ],
   [
    "2027-02-29T10:00",
    null
   ],
   [
    "2027-04-31T10:00",
    null
   ],
   [
    "2027-01-31T24:00",
    null
   ],
   [
    "",
    null
   ],
   [
    "2027-01-31T23:59:00+05:30",
    null
   ]
  ]
 },
 {
  "tz": "UTC",
  "values": [
   [
    "2027-12-31T23:59",
    "2027-12-31T23:59:00.000Z"
   ],
   [
    "2027-01-01T00:00",
    "2027-01-01T00:00:00.000Z"
   ],
   [
    "2027-01-01T00:60",
    null
   ]
  ]
 },
 {
  "tz": "America/New_York",
  "values": [
   [
    "2027-07-01T10:30",
    "2027-07-01T14:30:00.000Z"
   ],
   [
    "2027-01-01T10:30",
    "2027-01-01T15:30:00.000Z"
   ],
   [
    "2027-03-14T02:30",
    null
   ],
   [
    "2027-11-07T01:30",
    null
   ]
  ]
 }
];
for(const {tz,values} of cases){
 const script='import assert from "node:assert/strict";'+
  'import {localExpiryToUtcIso} from '+JSON.stringify(sourceUrl)+';'+
  'for(const [input,expected] of '+JSON.stringify(values)+')'+
  ' assert.equal(localExpiryToUtcIso(input),expected,"expiry "+input);';
 const child=spawnSync(process.execPath,['--experimental-strip-types',
  '--input-type=module','-e',script],{
   encoding:'utf8',env:{...process.env,TZ:tz}
  });
 assert.equal(child.status,0,'Expiry conversion failed in '+tz+': '+child.stderr);
}
const source=readFileSync(new URL('../frontend/components/admin-epin-batch-validation.tsx',import.meta.url),'utf8');
assert.match(source,/type="datetime-local"/,'Native calendar/time picker missing');
assert.match(source,/step=\{60\}/,'Minute-level precision must be explicit');
assert.match(source,/localExpiryToUtcIso\(expiresAt\)/,'Local time must convert to explicit UTC');
assert.match(source,/expiresAt:expiryUtc/,'API must receive timezone-bearing UTC, not local wall time');
assert.doesNotMatch(source,/type="text" maxLength=\{40\}/,'Old freeform ISO input must not return');
assert.match(source,/issuanceStatus!=='HOLD'/,'Policy preview must retain non-issuance guard');
console.log('E-PIN date/time picker: UTC conversion, DST gaps/overlaps, strict invalid dates, HOLD: PASS');
