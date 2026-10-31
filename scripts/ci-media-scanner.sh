#!/usr/bin/env bash
# CI-only scanner contract fixture, NOT a malware scanner. Never deploy this
# script as the production MEDIA_SCANNER_BIN: production enforces local clamscan.
set -euo pipefail
[[ "${1:-}" == "--no-summary" && "${2:-}" == "--stdout" && -f "${3:-}" ]] || exit 2
if grep -a -q "EICAR-STANDARD-ANTIVIRUS-TEST-FILE" "$3"; then
  echo "$3: CI-TEST-SIGNATURE FOUND"
  exit 1
fi
echo "$3: OK"
