import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

// Explicit App Router pages; backend-authenticated and server-RBAC guarded.
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const routes=[
 ['enquiries','enquiries'],
 ['members','members'],['staff','staff'],['audit','audit'],
 ['epin','epin'],['recovery','recovery'],['matrix','matrix']
];
const shell=read('frontend/components/admin-workspace.tsx');
const root=read('frontend/app/admin/page.tsx');
assert.match(root,/legacyAdminHref/,'Legacy admin links need safe redirects');
assert.match(root,/<AdminWorkspace view="overview"\s*\/>/);
assert.match(shell,/staffFetch\('staff\/me'\)/,'Workspace must authenticate with backend');
assert.match(shell,/if\(!permitted\.has\(view\)\)redirect\('\/admin'\)/,
 'Forbidden deep links must be denied server-side');
assert.match(shell,/aria-current=\{view===item\.view\?'page'/,
 'Active navigation must be accessible');
assert.doesNotMatch(shell,/\/admin\?view=/,'No single query-param router');
assert.doesNotMatch(shell,/content:'\/admin\/content'|media:'\/admin\/gallery'/,'Retired editor routes must not appear in navigation');
assert.doesNotMatch(shell,/AdminEpinBatchValidationPanel/,'Duplicate E-PIN policy form must be removed from Admin');
assert.match(shell,/AdminRegistrationPins/,'One Admin E-PIN inventory/creation form must be reachable');
assert.match(shell,/REGISTRATION_ACCESS_PIN_ENABLED/,'No-fee PIN generation must be explicitly gated');
assert.match(shell,/AdminMatrixPreview/,'Matrix sandbox must be mounted only for authorized Admin');
assert.match(shell,/AdminMemberRecoveryPanel/,'Keep gated member recovery');
for(const [segment,view] of routes){
 const page=read('frontend/app/admin/'+segment+'/page.tsx');
 assert.ok(page.includes('<AdminWorkspace view="'+view+'"/>'),
  'Missing route module '+segment);
 assert.match(page,/robots:\{index:false,follow:false\}/,
  'Staff deep link must not be indexed: '+segment);
}
for(const path of ['content','gallery'])assert.match(read('frontend/app/admin/'+path+'/page.tsx'),/redirect\('\/admin'\)/,'Retired CMS editor route must redirect: '+path);
console.log('Nisvartha member-first Admin routes, no editor navigation and noindex: PASS');
