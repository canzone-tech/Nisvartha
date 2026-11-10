import assert from 'node:assert/strict';

/**
 * M0 public-information contract: this URL stays available for factual reading,
 * but is not an enrolment endpoint and must never be search-indexable.
 * Shared by web, compiled-package and deployed-origin release smoke tests.
 */
export function assertAutoPoolInformationalRoute(status,html,context='Auto Pool'){
 assert.equal(status,200,context+': informational route should return HTTP 200');
 assert.match(html,/Public enrolment is not processed on this page/i,
  context+': controlled enrolment notice missing');
 const robotsTags=html.match(/<meta\b[^>]*>/gi)||[];
 assert.ok(robotsTags.some(tag=>/\bname=["']robots["']/i.test(tag)&&
   /\bcontent=["'][^"']*\bnoindex\b/i.test(tag)),
  context+': robots noindex metadata is mandatory');
}
