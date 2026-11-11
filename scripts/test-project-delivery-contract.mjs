import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(path,'utf8');
const rules=read('AGENTS.md');
for(const requirement of [
 'client-review','Full-feature client acceptance','Admin Business Rules',
 'immutable historical versions','authoritative MySQL','idempotent',
 'compiled backend/frontend','append-only migrations','npm run verify',
 'MEMBER_PIN_AUTO_ACTIVATE_ENABLED','not financial evidence'
])assert.ok(rules.toLowerCase().includes(requirement.toLowerCase()),
 'Missing repository acceptance rule: '+requirement);
const manifest=read('scripts/release-profile.mjs');
assert.match(manifest,/release_channel/);
assert.match(manifest,/migration_head/);
const bundle=read('.github/workflows/fullstack-package.yml');
assert.match(bundle,/client-review/);
assert.match(bundle,/matrix\.profile == 'client-acceptance'/,
 'Full financial artifact must have its own explicit build-time profile');
assert.match(bundle,/smoke-compiled-financial-acceptance\.mjs/,
 'Full financial compiled release must have independent end-to-end CI smoke');
assert.match(read('scripts/deploy-compiled-apache.sh'),/NISVARTHA_FINANCIAL_ACCEPTANCE_APPROVED/,
 'Full acceptance cutover needs its own explicit operator approval');
assert.match(read('scripts/deploy-compiled-apache.sh'),/validateClientReviewArtifact/);
console.log('Repository financial acceptance and compiled-only release instruction contract: PASS');
