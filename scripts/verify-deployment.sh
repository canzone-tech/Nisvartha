#!/usr/bin/env bash
# Read-only release-host checks. Never deploy, migrate, seed or write to MySQL.
set -euo pipefail
cd "$(dirname "$0")/.."

: "${NISVARTHA_API_ENV_FILE:?Set absolute path to approved API runtime env file}"
: "${NISVARTHA_WEB_ENV_FILE:?Set absolute path to approved web runtime env file}"
: "${SMOKE_WEB_ORIGIN:?Set the deployed HTTPS origin to inspect}"

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
node scripts/smoke-deployed-release.mjs
echo 'Nisvartha release-host preflight and read-only deployed smoke: PASS (human sign-off still required)'
