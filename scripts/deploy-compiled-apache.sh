#!/usr/bin/env bash
# Deploy ONLY a reviewed, checksum-verified compiled client-review artifact.
# Never run npm, git, Prisma migrations, or application builds on this host.
set -Eeuo pipefail
umask 077

fail(){ echo "Nisvartha deployment REFUSED: $*" >&2; exit 1; }
[[ $# -eq 2 ]] || fail 'Usage: deploy-compiled-apache.sh ABSOLUTE_TARBALL APPROVED_40_CHAR_SHA'
ARCHIVE=$1
SHA=$2
[[ $SHA =~ ^[0-9a-f]{40}$ ]] || fail 'Invalid approved SHA'
[[ $ARCHIVE == /* && -f $ARCHIVE ]] || fail 'Tarball path must be absolute and exist'
[[ $(basename "$ARCHIVE") == "nisvartha-fullstack-$SHA-client-review.tar.gz" ]] ||
 fail 'Tarball name does not match approved client-review SHA'
[[ $EUID -eq 0 ]] || fail 'Requires privileged release operator'
[[ ${NISVARTHA_MEMBER_RELEASE_APPROVED:-false} == true ]] || fail 'Explicit approved nonfinancial member release required'
# The server documentation uses node22/ while earlier release notes use
# node-v22.23.4/. Accept only the locked exact runtime, never system Node.
NODE=
for candidate in /opt/nisvartha/node22/bin/node /opt/nisvartha/node-v22.23.4/bin/node; do
 if [[ -x $candidate && $("$candidate" --version) == v22.23.4 ]]; then
  NODE=$candidate
  break
 fi
done
[[ -n $NODE ]] || fail 'Isolated Node.js v22.23.4 missing'
# One operator cutover at a time; never overwrite another release's staging.
exec 9>/run/lock/nisvartha-compiled-release.lock
flock -n 9 || fail 'Another compiled release is already in progress'
id nisvartha >/dev/null || fail 'Nisvartha service account missing'
[[ -L /srv/nisvartha/current ]] || fail 'Existing current release symlink missing'
[[ -r /etc/nisvartha/api.env && -r /etc/nisvartha/web.env ]] || fail 'Protected runtime environment missing'
systemctl is-active --quiet nisvartha-api || fail 'Existing API unhealthy'
systemctl is-active --quiet nisvartha-web || fail 'Existing web unhealthy'

CHECK="$ARCHIVE.sha256"
[[ -r $CHECK ]] || fail 'Release checksum missing'
(cd "$(dirname "$ARCHIVE")" && sha256sum -c "$(basename "$CHECK")") || fail 'Release checksum mismatch'
CONTENTS=$(tar -tzf "$ARCHIVE") || fail 'Unreadable release archive'
if grep -Eq '(^/|(^|/)\.\.(/|$))' <<< "$CONTENTS"; then
 fail 'Unsafe archive path'
fi
OLD=$(readlink -f /srv/nisvartha/current)
[[ -f $OLD/RELEASE_INFO.json ]] || fail 'Existing release manifest missing'
REL="/srv/nisvartha/releases/$SHA-fullstack"
[[ ! -e $REL && ! -L $REL ]] || fail 'Release directory already exists: no overwrite permitted'
API_NEXT="/etc/nisvartha/.api-$SHA.next"
WEB_NEXT="/etc/nisvartha/.web-$SHA.next"
WEB_DROP_DIR=/etc/systemd/system/nisvartha-web.service.d
WEB_DROP="$WEB_DROP_DIR/zz-nisvartha-compiled-release.conf"
API_DROP_DIR=/etc/systemd/system/nisvartha-api.service.d
API_DROP="$API_DROP_DIR/zz-nisvartha-compiled-release.conf"
WEB_DROP_EXISTED=0
API_DROP_EXISTED=0
BACKUP=
APACHE=
SWITCHED=0
STAGED=0
# Register rollback BEFORE extracting the archive or preparing candidate env.
# A failed preflight must not make the same approved SHA impossible to retry.
rollback(){
 local code=$?
 trap - EXIT ERR INT TERM
 if [[ $code -ne 0 && $SWITCHED -eq 1 ]]; then
  echo 'Deployment smoke FAILED; restoring previous release and configuration' >&2
  cp -a "$BACKUP/api.env" /etc/nisvartha/api.env
  cp -a "$BACKUP/web.env" /etc/nisvartha/web.env
  if [[ $API_DROP_EXISTED -eq 1 ]]; then
   cp -a "$BACKUP/api-runtime.conf" "$API_DROP"
  else
   rm -f "$API_DROP"
   rmdir "$API_DROP_DIR" 2>/dev/null || true
  fi
  if [[ $WEB_DROP_EXISTED -eq 1 ]]; then
   cp -a "$BACKUP/runtime.conf" "$WEB_DROP"
  else
   rm -f "$WEB_DROP"
   rmdir "$WEB_DROP_DIR" 2>/dev/null || true
  fi
  cp -a "$BACKUP/apache.conf" "$APACHE"
  ln -s "$OLD" "/srv/nisvartha/.rollback-current-$SHA"
  mv -Tf "/srv/nisvartha/.rollback-current-$SHA" /srv/nisvartha/current
  systemctl daemon-reload || true
  systemctl restart nisvartha-api || true
  systemctl restart nisvartha-web || true
  apache2ctl configtest && systemctl reload apache2 || true
 fi
 if [[ $code -ne 0 ]]; then
  rm -f "/srv/nisvartha/.next-current-$SHA" "/srv/nisvartha/.rollback-current-$SHA"
  if [[ $STAGED -eq 1 && $(readlink -f /srv/nisvartha/current) != "$REL" ]]; then
   rm -rf -- "$REL"
  fi
 fi
 rm -f "$API_NEXT" "$WEB_NEXT"
 exit "$code"
}
trap rollback EXIT
install -d -m 755 "$REL"
STAGED=1
tar --no-same-owner -xzf "$ARCHIVE" -C "$REL"
for file in api/dist/main.js web/server.js ops/release-profile.mjs ops/release-preflight.mjs \
 ops/prepare-release-env.mjs ops/smoke-staged-artifact.mjs ops/check-release-migrations.mjs RELEASE_INFO.json; do
 [[ -f $REL/$file ]] || fail "Compiled package missing: $file"
done

"$NODE" --input-type=module - "$REL" "$SHA" "$OLD" <<'NODECHECK'
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
const [root,sha,previous]=process.argv.slice(2);
const info=JSON.parse(readFileSync(join(root,'RELEASE_INFO.json'),'utf8'));
const old=JSON.parse(readFileSync(join(previous,'RELEASE_INFO.json'),'utf8'));
const {validateClientReviewArtifact}=await import(pathToFileURL(join(root,'ops/release-profile.mjs')));
if(info.commit!==sha||info.node_major!==22||info.origin!=='https://nisvarthafoundation.in'||
 validateClientReviewArtifact(info).length)
 throw Error('Unapproved build, migration difference, or invalid client-review profile');
console.log('Exact commit and nonfinancial release profile: PASS');
NODECHECK

# The old release may be at migration 0024 while this package is at 0035.
# Inspect the ACTUAL MySQL migration ledger; a manifest comparison alone
# would incorrectly block a successful forward-only migration.
"$NODE" --env-file=/etc/nisvartha/api.env \
 "$REL/ops/check-release-migrations.mjs" "$REL" "$OLD" ||
 fail 'Apply exact packaged forward migrations before attempting cutover'

[[ ! -e $API_NEXT && ! -e $WEB_NEXT ]] || fail 'Existing deployment candidates need review'
"$NODE" "$REL/ops/prepare-release-env.mjs" "$REL" \
 /etc/nisvartha/api.env "$API_NEXT" "$WEB_NEXT"
install -d -o nisvartha -g nisvartha -m 700 "$REL/web/.next/cache"
# Both compiled applications are tested on private alternate ports before cutover.
"$NODE" "$REL/ops/smoke-staged-artifact.mjs" "$REL" "$API_NEXT" "$WEB_NEXT"

# Dedicated last-in-order override; do not assume a legacy drop-in exists.
[[ ! -e $WEB_DROP || -f $WEB_DROP ]] || fail 'Unexpected frontend override type'
[[ ! -e $API_DROP || -f $API_DROP ]] || fail 'Unexpected API override type'
APACHE=$(readlink -f /etc/apache2/sites-enabled/nisvartha-preview-ssl.conf)
[[ -f $APACHE ]] || fail 'Nisvartha Apache TLS vhost missing'
grep -Fq 'http://127.0.0.1:3112/' "$APACHE" || fail 'Nisvartha web proxy is not on approved port'
grep -Fq 'http://127.0.0.1:3110/api/v1/' "$APACHE" || fail 'Nisvartha API proxy is not on approved port'

BACKUP=$(mktemp -d /root/nisvartha-release-rollback.XXXXXXXX)
cp -a /etc/nisvartha/api.env "$BACKUP/api.env"
cp -a /etc/nisvartha/web.env "$BACKUP/web.env"
if [[ -f $API_DROP ]]; then
 API_DROP_EXISTED=1
 cp -a "$API_DROP" "$BACKUP/api-runtime.conf"
fi
if [[ -f $WEB_DROP ]]; then
 WEB_DROP_EXISTED=1
 cp -a "$WEB_DROP" "$BACKUP/runtime.conf"
fi
cp -a "$APACHE" "$BACKUP/apache.conf"

# Atomic release selection. Do not change unrelated Node processes or vhosts.
SWITCHED=1
cp -a "$API_NEXT" /etc/nisvartha/api.env
cp -a "$WEB_NEXT" /etc/nisvartha/web.env
ln -s "$REL" "/srv/nisvartha/.next-current-$SHA"
mv -Tf "/srv/nisvartha/.next-current-$SHA" /srv/nisvartha/current
install -d -m 755 "$WEB_DROP_DIR"
install -d -m 755 "$API_DROP_DIR"
cat > "$API_DROP" <<UNIT
[Service]
ExecStart=
ExecStart=$NODE /srv/nisvartha/current/api/dist/main.js
UNIT
cat > "$WEB_DROP" <<UNIT
[Service]
WorkingDirectory=/srv/nisvartha/current/web
ExecStart=
ExecStart=$NODE /srv/nisvartha/current/web/server.js
Environment=PORT=3112
Environment=HOSTNAME=127.0.0.1
UNIT

# Only unblock the existing public informational Auto Pool page; it has no payments.
python3 - "$APACHE" <<'PY'
from pathlib import Path
import sys
path=Path(sys.argv[1]); before=path.read_text()
updated=before.replace('    ProxyPass /auto-pool-plan !\n','').replace(
 '    RedirectMatch 404 "^/auto-pool-plan(\\.html)?/?$"\n','')
if updated!=before:path.write_text(updated)
PY
apache2ctl configtest
systemctl daemon-reload
systemctl restart nisvartha-api
for i in $(seq 1 30); do
 if curl -fsS --max-time 2 http://127.0.0.1:3110/api/v1/health/ready >/dev/null 2>&1; then break; fi
 sleep 1
done
curl -fsS --max-time 5 http://127.0.0.1:3110/api/v1/health/ready >/dev/null
systemctl restart nisvartha-web
for i in $(seq 1 30); do
 if curl -fsS --max-time 2 http://127.0.0.1:3112/member/login >/dev/null 2>&1; then break; fi
 sleep 1
done
curl -fsS --max-time 5 http://127.0.0.1:3112/member/register >/dev/null
curl -fsS --max-time 5 http://127.0.0.1:3112/admin/login >/dev/null
systemctl reload apache2
URL=https://nisvarthafoundation.in
for route in / /member/login /member/register /admin/login /auto-pool-plan /api/v1/health/ready; do
 status=$(curl --noproxy '*' --resolve nisvarthafoundation.in:443:127.0.0.1 \
  -sS --max-time 12 -o /dev/null -w '%{http_code}' "$URL$route")
 [[ $status == 200 ]] || fail "HTTPS route $route returned $status"
done
STATUS=$(curl --noproxy '*' --resolve nisvarthafoundation.in:443:127.0.0.1 \
 -sS --max-time 12 -o /dev/null -w '%{http_code}' "$URL/api/v1/members/me")
[[ $STATUS == 401 ]] || fail 'Anonymous member endpoint authorization failed'
"$NODE" "$REL/ops/release-profile.mjs" check /etc/nisvartha/api.env /etc/nisvartha/web.env "$REL/RELEASE_INFO.json"
systemctl is-active --quiet nisvartha-api && systemctl is-active --quiet nisvartha-web
rm -f "$API_NEXT" "$WEB_NEXT"
SWITCHED=0
trap - EXIT
echo "Nisvartha compiled client-review release $SHA: VERIFIED AND ACTIVE"
echo "Rollback snapshot retained in $BACKUP (restricted permissions)"
echo 'Live payments and compensation remain disabled; protected PIN key needs off-host recovery escrow.'
