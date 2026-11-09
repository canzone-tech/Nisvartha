#!/usr/bin/env bash
# Read-only release-host checks. Never deploy, migrate, seed or write to MySQL.
set -euo pipefail
cd "$(dirname "$0")/.."

: "${NISVARTHA_API_ENV_FILE:?Set absolute path to approved API runtime env file}"
: "${NISVARTHA_WEB_ENV_FILE:?Set absolute path to approved web runtime env file}"
: "${SMOKE_WEB_ORIGIN:?Set the deployed HTTPS origin to inspect}"
: "${NISVARTHA_RELEASE_APPROVED_SHA:?Set approved full integration commit SHA}"
[[ "$NISVARTHA_RELEASE_APPROVED_SHA" =~ ^[a-f0-9]{40}$ ]] ||
 { echo 'Approved release commit must be an exact 40-character lowercase SHA' >&2; exit 2; }
manifest="${NISVARTHA_RELEASE_MANIFEST:-/srv/nisvartha/current/RELEASE_INFO.json}"

for file in "$NISVARTHA_API_ENV_FILE" "$NISVARTHA_WEB_ENV_FILE"; do
 case "$file" in /*) ;; *) echo 'Release env paths must be absolute' >&2; exit 2;; esac
 [[ -f "$file" && -r "$file" ]] || { echo 'Release env file missing/unreadable' >&2; exit 2; }
 case "$file" in "$PWD"/*) echo 'Release env files must not be inside the Git repository' >&2; exit 2;; esac
done

command -v node >/dev/null || { echo 'Node.js 22+ required' >&2; exit 2; }
node -e "if(Number(process.versions.node.split('.')[0])!==22) process.exit(1)" ||
 { echo 'This release is pinned to Node.js 22' >&2; exit 2; }

node --env-file="$NISVARTHA_API_ENV_FILE" scripts/release-preflight.mjs api
node --env-file="$NISVARTHA_WEB_ENV_FILE" scripts/release-preflight.mjs web
# Guard against green checks on a different domain than the actual release.
web_origin="$(node --env-file="$NISVARTHA_WEB_ENV_FILE" -e 'process.stdout.write(new URL(process.env.NEXT_PUBLIC_SITE_URL).origin)')"
api_origin="$(node --env-file="$NISVARTHA_API_ENV_FILE" -e 'process.stdout.write(new URL(process.env.PUBLIC_WEB_ORIGIN).origin)')"
smoke_origin="$(node -e 'process.stdout.write(new URL(process.env.SMOKE_WEB_ORIGIN).origin)')"
[[ "$web_origin" == "$api_origin" && "$web_origin" == "$smoke_origin" ]] ||
 { echo 'API, web, and deployed smoke origins do not match' >&2; exit 1; }
# Detect a mismatched compiled Next.js bundle, live API, and approved feature flags.
[[ "$manifest" == /* && -r "$manifest" ]] ||
 { echo 'Compiled release manifest is missing or not an absolute path' >&2; exit 2; }
node scripts/release-profile.mjs check "$NISVARTHA_API_ENV_FILE" "$NISVARTHA_WEB_ENV_FILE" "$manifest"
# Derive read-only smoke expectations from the exact approved web runtime
# configuration, never from operator-supplied bypass toggles.
read_web_flag(){
 node --env-file="$NISVARTHA_WEB_ENV_FILE" -e \
  'process.stdout.write(process.env[process.argv[1]]==="true"?"true":"false")' "$1"
}
member_portal="$(read_web_flag MEMBER_PORTAL_ENABLED)"
member_disabled=true
[[ "$member_portal" == true ]] && member_disabled=false
content_noindex=true
[[ "$(read_web_flag PUBLIC_CONTENT_APPROVED)" == true ]] && content_noindex=false
SMOKE_EXPECT_MEMBER_DISABLED="$member_disabled" \
SMOKE_EXPECT_MEMBER_REGISTRATION_ENABLED="$(read_web_flag MEMBER_APPLICATIONS_ENABLED)" \
SMOKE_EXPECT_REGISTRATION_PIN_ENABLED="$(read_web_flag REGISTRATION_ACCESS_PIN_ENABLED)" \
SMOKE_EXPECT_PIN_AUTO_ACTIVATE_ENABLED="$(read_web_flag MEMBER_PIN_AUTO_ACTIVATE_ENABLED)" \
SMOKE_EXPECT_NO_INDEX="$content_noindex" \
node scripts/smoke-deployed-release.mjs
echo 'Nisvartha release-host preflight and read-only deployed smoke: PASS (human sign-off still required)'
