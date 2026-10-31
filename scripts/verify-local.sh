#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
command -v node >/dev/null || { echo 'Node.js required' >&2; exit 1; }
command -v npm >/dev/null || { echo 'npm required' >&2; exit 1; }
command -v docker >/dev/null || { echo 'Docker required' >&2; exit 1; }
compose=(docker compose -f infra/compose.verify.yml)
cleanup(){ "${compose[@]}" down -v --remove-orphans >/dev/null 2>&1 || true; }
trap cleanup EXIT
"${compose[@]}" up -d --wait
export DATABASE_URL='mysql://nisvartha_ci:testpass@127.0.0.1:33306/nisvartha_ci'
export PUBLIC_WEB_ORIGIN='http://127.0.0.1:3102'
npm ci --prefix backend --no-audit
npm ci --prefix frontend --no-audit
node scripts/check-scope.mjs
npm --prefix backend run verify
npm --prefix backend run prisma:migrate
node scripts/smoke-api.mjs
node scripts/smoke-operator.mjs
VERIFY_MYSQL_CONTAINER="$("${compose[@]}" ps -q mysql)" VERIFY_MYSQL_ROOT_PASSWORD='root_verify_only' node scripts/smoke-backup.mjs
npm --prefix frontend run verify
node scripts/smoke-web.mjs
echo 'Nisvartha complete local verification: PASS'
