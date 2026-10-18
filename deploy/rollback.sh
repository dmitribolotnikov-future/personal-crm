#!/usr/bin/env bash
# Manual rollback: deploys the previous image again; it is still on the server.
# Never run automatically. Usage: bash rollback.sh
set -euo pipefail

cd "$(dirname "$0")"

if [ "$(wc -l < releases)" -lt 2 ]; then
  echo "No previous version on the server to roll back to." >&2
  exit 1
fi

exec bash deploy.sh "$(head -n 1 releases)"
