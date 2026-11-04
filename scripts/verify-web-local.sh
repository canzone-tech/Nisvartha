#!/usr/bin/env bash
# Docker-free frontend verification (NOT a substitute for real MySQL API tests).
set -euo pipefail
cd "$(dirname "$0")/.."
command -v node >/dev/null || { echo 'Node.js 22 required' >&2; exit 2; }
command -v npm >/dev/null || { echo 'npm required' >&2; exit 2; }
node -e "if(Number(process.versions.node.split('.')[0])!==22) process.exit(1)" ||
 { echo 'Nisvartha web verification requires Node.js 22' >&2; exit 2; }
if [[ -z "${CHROME_BIN:-}" ]]; then
 command -v chromium >/dev/null || command -v google-chrome >/dev/null ||
 command -v google-chrome-stable >/dev/null ||
 { echo 'Chromium/Chrome required for full browser UAT' >&2; exit 2; }
fi
# Keep unapproved forms, indexing, membership and financial functionality held
# even when a developer shell has personal launch environment variables.
unset NODE_ENV
export PUBLIC_CONTENT_APPROVED=false CMS_PUBLIC_CONTENT_ENABLED=false
export NEXT_PUBLIC_FORMS_ENABLED=false NEXT_PUBLIC_PRIVACY_APPROVED=false
export FORM_SUBMISSIONS_ENABLED=false PRIVACY_NOTICE_APPROVED=false
export MEMBER_PORTAL_ENABLED=false MEMBER_APPLICATIONS_ENABLED=false MEMBER_STAFF_REGISTRATION_ENABLED=false MEMBER_RECOVERY_ENABLED=false
export NISVARTHA_UAT_PIN_REGISTRATION=false
export NISVARTHA_CLIENT_TEMPLATE_PREVIEW=false
export NEXT_PUBLIC_SITE_URL='http://127.0.0.1:3102'
export NEXT_PUBLIC_API_URL='http://127.0.0.1:3100'
export API_INTERNAL_URL='http://127.0.0.1:3100'
unset PRIVACY_NOTICE_VERSION MEMBER_TERMS_VERSION MEMBER_PRIVACY_VERSION
tracked_before="$(git status --porcelain=v1 --untracked-files=no)"
npm ci --prefix frontend --no-audit
node scripts/check-scope.mjs
node scripts/test-release-preflight.mjs
node scripts/test-release-smoke.mjs
node scripts/test-local-uat.mjs
npm --prefix frontend run verify
node scripts/smoke-web.mjs
node scripts/smoke-browser.mjs
# Verify the exact client template through a compiled Next.js server.
# Restore the default build so unapproved content is never shipped by mistake.
NISVARTHA_CLIENT_TEMPLATE_PREVIEW=true npm --prefix frontend run build
NISVARTHA_CLIENT_TEMPLATE_PREVIEW=true node scripts/smoke-client-bundle.mjs
NISVARTHA_CLIENT_TEMPLATE_PREVIEW=false npm --prefix frontend run build
tracked_after="$(git status --porcelain=v1 --untracked-files=no)"
if [[ "$tracked_before" != "$tracked_after" ]]; then
 echo 'Frontend verification modified tracked files (paths only):' >&2
 git status --short --untracked-files=no >&2
 git diff --no-ext-diff -- frontend/next-env.d.ts >&2
 exit 1
fi
echo 'Nisvartha Docker-free local frontend build, browser and security regression: PASS'
