import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const header=read('frontend/components/site-header.tsx');
const layout=read('frontend/app/layout.tsx');
const chrome=read('frontend/components/site-chrome.tsx');
const styles=read('frontend/app/globals.css');
const launcher=read('scripts/local-uat.sh');
const manifest=JSON.parse(read('frontend/vendor/client-bundle-v1.1.manifest.json'));
for(const label of [
 'Home','About Us','Activities','Go Green','Projects','Volunteer','Donate',
 'Membership','Auto Pool Plan','Gallery','News & Events','Contact','Login','Register'
])assert.ok(header.includes("'"+label+"'"),'Client navigation label changed: '+label);
assert.match(header,/aria-expanded=\{open\}/);
assert.match(header,/id="main-nav"/);
assert.match(header,/\/member\/login/);
assert.match(header,/\/member\/register/);
assert.match(chrome,/className="footer client-footer"/);
assert.match(layout,/SiteChrome/);
assert.match(chrome,/className="footgrid"/);
assert.match(chrome,/Member Login/);
assert.match(chrome,/All rights reserved/);
assert.doesNotMatch(chrome,/(prototype|demo)/i,'Production site chrome must not expose prototype/demo copy');
assert.match(chrome,/isAdmin\|\|isMember/);
assert.match(styles,/--navy:#123b63/);
assert.match(styles,/--green:#167447/);
assert.match(styles,/--gold:#c28a21/);
assert.match(styles,/\.foundation-admin-welcome\{background:linear-gradient\(120deg,var\(--navy\),var\(--green\)\)/);
assert.match(launcher,/NISVARTHA_UAT_ONESHOT/);
assert.match(launcher,/NISVARTHA_CLIENT_TEMPLATE_PREVIEW=true/);
assert.equal(Object.keys(manifest.files).length,20);
console.log('Unified production client design on public/Admin/member, accessible navigation and isolated local test controls: PASS');
