import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const compensation=readFileSync('backend/src/members/member-compensation.service.ts','utf8');
const matrix=readFileSync('backend/src/members/matrix-placement.service.ts','utf8');
assert.match(compensation,/NODE_ENV==='production'[\s\S]*MEMBER_COMPENSATION_APPROVED!=='true'/,
 'Production compensation service must require an independent approval flag');
assert.match(matrix,/NODE_ENV!=='production'\|\|process\.env\.MEMBER_COMPENSATION_APPROVED==='true'/,
 'Matrix credits must fail closed when production compensation approval is absent');
console.log('Production compensation runtime approval gate: PASS');
