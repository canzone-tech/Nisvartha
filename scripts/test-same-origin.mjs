import assert from 'node:assert/strict';
import {enforceSameOrigin} from '../frontend/lib/same-origin.ts';

const request=(url,origin,headers={})=>new Request(url,{method:'POST',headers:{Origin:origin,...headers}});
assert.equal(enforceSameOrigin(request('http://127.0.0.1:3102/api/test','http://127.0.0.1:3102')),true);
assert.equal(enforceSameOrigin(request('http://127.0.0.1:3102/api/test','https://example.org',{
 Host:'example.org','X-Forwarded-Proto':'https'
})),true,'TLS reverse proxy origin must validate against trusted forwarded protocol');
assert.equal(enforceSameOrigin(request('http://127.0.0.1:3102/api/test','http://example.org',{
 Host:'example.org','X-Forwarded-Proto':'https'
})),false,'HTTPS proxy must reject HTTP browser origin');
assert.equal(enforceSameOrigin(request('http://127.0.0.1:3102/api/test','https://evil.example',{
 Host:'example.org','X-Forwarded-Proto':'https'
})),false,'Foreign origin must be denied');
assert.equal(enforceSameOrigin(request('http://127.0.0.1:3102/api/test','https://example.org',{
 Host:'example.org','X-Forwarded-Proto':'https,http'
})),false,'Ambiguous forwarded protocol must be denied');
assert.equal(enforceSameOrigin(new Request('http://127.0.0.1:3102/api/test',{method:'POST'})),false);
console.log('Proxy-aware browser same-origin contract: PASS');
