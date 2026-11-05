#!/usr/bin/env bash
# Disposable local UAT. Starts compiled NestJS + Next.js on loopback with
# synthetic MySQL, media, scanner and an ephemeral staff account. CTRL+C
# removes ONLY this script's randomly named Compose project and test files.
set -euo pipefail
cd "$(dirname "$0")/.."
for program in node npm docker git setsid install; do
 command -v "$program" >/dev/null || { echo "Local UAT requires $program" >&2; exit 2; }
done
node -e "if(Number(process.versions.node.split('.')[0])!==22) process.exit(1)" ||
 { echo 'Local UAT requires Node.js 22' >&2; exit 2; }
docker compose version >/dev/null || { echo 'Docker Compose v2 required' >&2; exit 2; }
docker info >/dev/null 2>&1 || { echo 'Docker daemon unavailable to current user' >&2; exit 2; }
api_port="${NISVARTHA_UAT_API_PORT:-3100}"
web_port="${NISVARTHA_UAT_WEB_PORT:-3102}"
export NISVARTHA_VERIFY_DB_PORT="${NISVARTHA_UAT_DB_PORT:-33307}"
for port in "$api_port" "$web_port" "$NISVARTHA_VERIFY_DB_PORT"; do
 [[ "$port" =~ ^[0-9]+$ ]] &&
 ((10#$port>=1024 && 10#$port<=65535)) ||
 { echo 'Local UAT ports must be 1024–65535' >&2; exit 2; }
done
[[ "$api_port" != "$web_port" && "$api_port" != "$NISVARTHA_VERIFY_DB_PORT" &&
   "$web_port" != "$NISVARTHA_VERIFY_DB_PORT" ]] ||
 { echo 'UAT backend, web and DB ports must differ' >&2; exit 2; }
# Fail before any mutation if a running local service already owns a port.
node -e 'const {createServer}=require("node:net"); Promise.all(process.argv.slice(1).map(p=>new Promise((resolve,reject)=>{const s=createServer();s.once("error",reject);s.listen(Number(p),"127.0.0.1",()=>s.close(resolve));}))).catch(()=>{console.error("UAT port already in use");process.exitCode=2;})' "$api_port" "$web_port" "$NISVARTHA_VERIFY_DB_PORT"
project="nisvartha-uat-$(node -e "process.stdout.write(require('node:crypto').randomBytes(5).toString('hex'))")"
compose=(docker compose --project-name "$project" -f infra/compose.verify.yml)
scratch="$(mktemp -d /tmp/nisvartha-uat-XXXXXXXX)"
media="$(mktemp -d /tmp/nisvartha-uat-media-XXXXXXXX)"
backend_pid=''
web_pid=''
cleanup(){
 local result=$?
 trap - EXIT INT TERM
 for pid in "$web_pid" "$backend_pid"; do
  if [[ -n "$pid" ]]; then kill -TERM -- "-$pid" 2>/dev/null || true; fi
 done
 "${compose[@]}" down -v --remove-orphans >/dev/null 2>&1 || true
 [[ "$scratch" == /tmp/nisvartha-uat-* ]] && rm -rf -- "$scratch"
 [[ "$media" == /tmp/nisvartha-uat-media-* ]] && rm -rf -- "$media"
 exit "$result"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
unset NODE_ENV
export HOST=127.0.0.1 PORT="$api_port"
export DATABASE_URL="mysql://nisvartha_ci:testpass@127.0.0.1:${NISVARTHA_VERIFY_DB_PORT}/nisvartha_ci"
export PUBLIC_WEB_ORIGIN="http://127.0.0.1:$web_port"
export NEXT_PUBLIC_SITE_URL="http://127.0.0.1:$web_port"
export NEXT_PUBLIC_API_URL="http://127.0.0.1:$api_port"
export API_INTERNAL_URL="http://127.0.0.1:$api_port"
export MEDIA_STORAGE_ROOT="$media"
export MEDIA_SCANNER_BIN="$scratch/ci-media-scanner.sh"
# CMS is locally testable only after an independent synthetic staff approval.
# Indexing and collection remain OFF. No real payment/E-PIN route exists.
export PUBLIC_CONTENT_APPROVED=false CMS_PUBLIC_CONTENT_ENABLED=true
export NEXT_PUBLIC_FORMS_ENABLED=false NEXT_PUBLIC_PRIVACY_APPROVED=false
export FORM_SUBMISSIONS_ENABLED=false PRIVACY_NOTICE_APPROVED=false
export MEMBER_PORTAL_ENABLED=false MEMBER_APPLICATIONS_ENABLED=false MEMBER_STAFF_REGISTRATION_ENABLED=false MEMBER_RECOVERY_ENABLED=false
export NISVARTHA_UAT_PIN_REGISTRATION=false
export NISVARTHA_CLIENT_TEMPLATE_PREVIEW=false
# Normal compiled Next.js routes already use the client design AND real APIs.
# Strict byte-identical static HTML preview remains an explicit visual option.
case "${NISVARTHA_UAT_CLIENT_TEMPLATE:-off}" in
 exact) export NISVARTHA_CLIENT_TEMPLATE_PREVIEW=true ;;
 off) : ;;
 *) echo 'NISVARTHA_UAT_CLIENT_TEMPLATE must be exact or off' >&2; exit 2 ;;
esac
unset PRIVACY_NOTICE_VERSION MEMBER_TERMS_VERSION MEMBER_PRIVACY_VERSION
# Interactive UAT enables all nonfinancial synthetic journeys together.
# One-shot CI and production-like verification stay default OFF.
default_mode=synthetic
if [[ "${NISVARTHA_UAT_ONESHOT:-false}" == true ]]; then default_mode=off; fi
export NISVARTHA_UAT_MEMBERS="${NISVARTHA_UAT_MEMBERS:-$default_mode}"
export NISVARTHA_UAT_PIN_FLOW="${NISVARTHA_UAT_PIN_FLOW:-$default_mode}"
export NISVARTHA_UAT_FORMS="${NISVARTHA_UAT_FORMS:-$default_mode}"
export NISVARTHA_UAT_PLAN="${NISVARTHA_UAT_PLAN:-$default_mode}"
for mode in "$NISVARTHA_UAT_MEMBERS" "$NISVARTHA_UAT_PIN_FLOW" "$NISVARTHA_UAT_FORMS" "$NISVARTHA_UAT_PLAN"; do
 [[ "$mode" == synthetic || "$mode" == off ]] ||
  { echo 'Local UAT modes must be off or synthetic' >&2; exit 2; }
done
if [[ "$NISVARTHA_UAT_MEMBERS" == synthetic ]]; then
 export MEMBER_PORTAL_ENABLED=true MEMBER_APPLICATIONS_ENABLED=true
 export MEMBER_STAFF_REGISTRATION_ENABLED=true
 export MEMBER_TERMS_VERSION='synthetic-uat-terms-v1'
 export MEMBER_PRIVACY_VERSION='synthetic-uat-privacy-v1'
fi
if [[ "$NISVARTHA_UAT_PIN_FLOW" == synthetic ]]; then
 [[ "$NISVARTHA_UAT_MEMBERS" == synthetic ]] ||
  { echo 'Synthetic E-PIN signup requires synthetic members' >&2; exit 2; }
 export NISVARTHA_UAT_PIN_REGISTRATION=synthetic
fi
if [[ "$NISVARTHA_UAT_FORMS" == synthetic ]]; then
 export NEXT_PUBLIC_FORMS_ENABLED=true NEXT_PUBLIC_PRIVACY_APPROVED=true
 export FORM_SUBMISSIONS_ENABLED=true PRIVACY_NOTICE_APPROVED=true
 export PRIVACY_NOTICE_VERSION='synthetic-uat-privacy-v1'
fi
install -m 700 scripts/ci-media-scanner.sh "$MEDIA_SCANNER_BIN"
echo 'Starting isolated synthetic MySQL for local-only Nisvartha UAT...'
"${compose[@]}" up -d --wait
npm ci --prefix backend --no-audit
npm ci --prefix frontend --no-audit
node scripts/check-scope.mjs
npm --prefix backend run verify
npm --prefix backend run prisma:migrate
npm --prefix frontend run verify
staff_email='local-admin@example.invalid'
staff_password="$(node -e "process.stdout.write(require('node:crypto').randomBytes(24).toString('base64url'))")"
printf '%s\n' "$staff_password" |
 NISVARTHA_BOOTSTRAP_EMAIL="$staff_email" NISVARTHA_BOOTSTRAP_NAME='Local UAT Admin' npm --prefix backend run staff:bootstrap
setsid node backend/dist/main.js >"$scratch/api.log" 2>&1 &
backend_pid=$!
setsid npm --prefix frontend run start -- -H 127.0.0.1 -p "$web_port" >"$scratch/web.log" 2>&1 &
web_pid=$!
ready=false
for attempt in $(seq 1 80); do
 # Readiness polling must NEVER perform a login or mutation. It only confirms
 # the compiled HTTP listeners are healthy, then integration smoke runs once.
 if node -e 'const [api,web]=process.argv.slice(1); Promise.all([fetch(api+"/api/v1/health/ready",{signal:AbortSignal.timeout(1800)}),fetch(web+"/",{signal:AbortSignal.timeout(1800)})]).then(([a,w])=>process.exit(a.ok&&w.ok?0:1)).catch(()=>process.exit(1))' \
    "http://127.0.0.1:$api_port" "http://127.0.0.1:$web_port" >/dev/null 2>&1; then
  ready=true
  break
 fi
 kill -0 "$backend_pid" 2>/dev/null && kill -0 "$web_pid" 2>/dev/null ||
  { echo 'UAT runtime exited before readiness; diagnostics:' >&2; tail -n 15 "$scratch/api.log" "$scratch/web.log" >&2; exit 1; }
 sleep 0.5
done
[[ "$ready" == true ]] ||
 { echo 'UAT readiness timed out; diagnostics:' >&2; tail -n 15 "$scratch/api.log" "$scratch/web.log" >&2; exit 1; }
if ! NISVARTHA_UAT_WEB_ORIGIN="http://127.0.0.1:$web_port" \
    NISVARTHA_UAT_API_ORIGIN="http://127.0.0.1:$api_port" \
    NISVARTHA_UAT_STAFF_EMAIL="$staff_email" \
    NISVARTHA_UAT_STAFF_PASSWORD="$staff_password" \
    node scripts/smoke-local-uat.mjs >"$scratch/smoke.log" 2>&1; then
 echo 'Local UAT authenticated integration smoke failed (single attempt):' >&2
 tail -n 30 "$scratch/smoke.log" >&2
 exit 1
fi
# One ADMIN identity owns all synthetic member, scenario and enquiry workflows.
# Check the complete PIN -> approved member -> direct invite sequence on the
# same compiled servers/temporary DB, then remove only the synthetic fixture.
if [[ "$NISVARTHA_UAT_MEMBERS" == synthetic && "$NISVARTHA_UAT_PIN_FLOW" == synthetic ]]; then
 NISVARTHA_UAT_WEB_ORIGIN="http://127.0.0.1:$web_port" \
 NISVARTHA_UAT_API_ORIGIN="http://127.0.0.1:$api_port" \
 NISVARTHA_UAT_STAFF_EMAIL="$staff_email" \
 NISVARTHA_UAT_STAFF_PASSWORD="$staff_password" \
 node scripts/smoke-local-member-invites.mjs
fi
if [[ "${NISVARTHA_UAT_ONESHOT:-false}" == true ]]; then
 echo 'Local compiled full-stack UAT one-shot: PASS (synthetic staff, DB, media, held feature routes)'
 unset staff_password
 exit 0
fi
echo
echo 'Local Nisvartha UAT: READY (synthetic forms/member/PIN journeys; NO real payment or commission)'
echo "Website: http://127.0.0.1:$web_port"
echo "Staff:   http://127.0.0.1:$web_port/admin/login"
echo "Email:   $staff_email"
echo "Temporary Admin password: $staff_password"
echo "UAT modes: forms=$NISVARTHA_UAT_FORMS members=$NISVARTHA_UAT_MEMBERS pins=$NISVARTHA_UAT_PIN_FLOW plan=$NISVARTHA_UAT_PLAN"
echo "Public enquiry: http://127.0.0.1:$web_port/contact"
echo "Volunteer: http://127.0.0.1:$web_port/volunteer"
echo "Public registration: http://127.0.0.1:$web_port/member/register"
echo "Admin E-PIN inventory: http://127.0.0.1:$web_port/admin/epin"
echo "Admin members: http://127.0.0.1:$web_port/admin/members"
echo 'The same synthetic Admin creates, reviews and approves member applications; public website copy stays fixed.'
echo 'Use only synthetic data. Scanner is a TEST FIXTURE, not real ClamAV. Press CTRL+C to stop and remove test data.'
unset staff_password
# Waiting for either compiled server preserves a browsable local UAT session.
wait -n "$backend_pid" "$web_pid" ||
 { echo 'Local UAT server exited unexpectedly' >&2; exit 1; }
echo 'Local UAT runtime stopped.'
