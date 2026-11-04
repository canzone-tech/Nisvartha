#!/usr/bin/env bash
# Disposable verification ONLY. Never cleans up other Compose projects.
set -euo pipefail
cd "$(dirname "$0")/.."
command -v node >/dev/null || { echo 'Node.js 22 required' >&2; exit 1; }
command -v npm >/dev/null || { echo 'npm required' >&2; exit 1; }
command -v docker >/dev/null || { echo 'Docker required' >&2; exit 1; }
node -e "if(Number(process.versions.node.split('.')[0])!==22) process.exit(1)" ||
 { echo 'Local verification requires Node.js 22' >&2; exit 1; }
docker compose version >/dev/null || { echo 'Docker Compose v2 required' >&2; exit 1; }
docker info >/dev/null 2>&1 || { echo 'Docker daemon unavailable to current user' >&2; exit 1; }
if [[ -z "${CHROME_BIN:-}" ]]; then
 command -v chromium >/dev/null || command -v google-chrome >/dev/null ||
 command -v google-chrome-stable >/dev/null ||
 { echo 'Chromium or Chrome required for local browser UAT' >&2; exit 1; }
fi
export NISVARTHA_VERIFY_DB_PORT="${NISVARTHA_VERIFY_DB_PORT:-33306}"
[[ "$NISVARTHA_VERIFY_DB_PORT" =~ ^[0-9]+$ ]] &&
 ((10#$NISVARTHA_VERIFY_DB_PORT>=1024 && 10#$NISVARTHA_VERIFY_DB_PORT<=65535)) ||
 { echo 'NISVARTHA_VERIFY_DB_PORT must be 1024–65535' >&2; exit 1; }
project="nisvartha-verify-$(node -e "process.stdout.write(require('node:crypto').randomBytes(5).toString('hex'))")"
compose=(docker compose --project-name "$project" -f infra/compose.verify.yml)
scratch="$(mktemp -d /tmp/nisvartha-verify-XXXXXXXX)"
media="$(mktemp -d /tmp/nisvartha-media-ci-XXXXXXXX)"
tracked_before="$(git status --porcelain=v1 --untracked-files=no)"
cleanup(){
 local result=$?
 trap - EXIT INT TERM
 "${compose[@]}" down -v --remove-orphans >/dev/null 2>&1 || true
 [[ "$scratch" == /tmp/nisvartha-verify-* ]] && rm -rf -- "$scratch"
 [[ "$media" == /tmp/nisvartha-media-ci-* ]] && rm -rf -- "$media"
 exit "$result"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
# Force disposable DB and default-off policy gates, never inherit live config.
unset NODE_ENV
export DATABASE_URL="mysql://nisvartha_ci:testpass@127.0.0.1:${NISVARTHA_VERIFY_DB_PORT}/nisvartha_ci"
export PUBLIC_WEB_ORIGIN='http://127.0.0.1:3102'
export NEXT_PUBLIC_SITE_URL='http://127.0.0.1:3102'
export NEXT_PUBLIC_API_URL='http://127.0.0.1:3100'
export API_INTERNAL_URL='http://127.0.0.1:3100'
export MEDIA_STORAGE_ROOT="$media"
export MEDIA_SCANNER_BIN="$scratch/ci-media-scanner.sh"
export PUBLIC_CONTENT_APPROVED=false CMS_PUBLIC_CONTENT_ENABLED=false
export NEXT_PUBLIC_FORMS_ENABLED=false NEXT_PUBLIC_PRIVACY_APPROVED=false
export FORM_SUBMISSIONS_ENABLED=false PRIVACY_NOTICE_APPROVED=false
export MEMBER_PORTAL_ENABLED=false MEMBER_APPLICATIONS_ENABLED=false MEMBER_STAFF_REGISTRATION_ENABLED=false MEMBER_RECOVERY_ENABLED=false
unset PRIVACY_NOTICE_VERSION MEMBER_TERMS_VERSION MEMBER_PRIVACY_VERSION
# Copy scanner fixture rather than chmod a tracked source file.
install -m 700 scripts/ci-media-scanner.sh "$MEDIA_SCANNER_BIN"
"${compose[@]}" up -d --wait
npm ci --prefix backend --no-audit
npm ci --prefix frontend --no-audit
node scripts/check-scope.mjs
node scripts/test-release-preflight.mjs
node scripts/test-release-smoke.mjs
node scripts/test-local-uat.mjs
npm --prefix backend run verify
node scripts/test-opaque-credential.mjs
node scripts/test-epin-batch.mjs
node scripts/test-uat-epin-candidates.mjs
node scripts/test-epin-redemption-preconditions.mjs
node scripts/test-epin-bearer-verification.mjs
npm --prefix backend run prisma:migrate
node scripts/smoke-api.mjs
node scripts/smoke-proxy-throttle.mjs
node scripts/smoke-cms.mjs
node scripts/smoke-super-admin-rbac.mjs
node scripts/smoke-members.mjs
node scripts/smoke-member-review-pagination.mjs
node scripts/smoke-member-recovery.mjs
node scripts/smoke-media.mjs
node scripts/reconcile-media.mjs
node scripts/test-enquiry-cases.mjs
node scripts/test-volunteer.mjs
"${compose[@]}" exec -T -e MYSQL_PWD=root_verify_only mysql mysql -uroot -e "CREATE USER 'nisvartha_operator'@'%' IDENTIFIED BY 'testreadonly'; GRANT SELECT ON nisvartha_ci.enquiries TO 'nisvartha_operator'@'%';"
NISVARTHA_OPERATOR_DATABASE_URL="mysql://nisvartha_operator:testreadonly@127.0.0.1:${NISVARTHA_VERIFY_DB_PORT}/nisvartha_ci" node scripts/smoke-operator.mjs
VERIFY_MYSQL_CONTAINER="$("${compose[@]}" ps -q mysql)" VERIFY_MYSQL_ROOT_PASSWORD='root_verify_only' node scripts/smoke-backup.mjs
npm --prefix frontend run verify
node scripts/smoke-cms-public.mjs
node scripts/smoke-member-web.mjs
node scripts/smoke-web.mjs
node scripts/smoke-browser.mjs
tracked_after="$(git status --porcelain=v1 --untracked-files=no)"
if [[ "$tracked_before" != "$tracked_after" ]]; then
 echo 'Local verification modified tracked files (paths only):' >&2
 git status --short --untracked-files=no >&2
 echo 'Review the generated file contract; verification must not silently rewrite tracked code.' >&2
 exit 1
fi
echo 'Nisvartha complete isolated local verification: PASS'
