#!/usr/bin/env bash
# Loads test contacts into the server database, by hand only: bash seed.sh
# Runs scripts/seed.mts from the current image; a repeat run adds nothing.
set -euo pipefail

cd "$(dirname "$0")"

APP_IMAGE="$(tail -n 1 releases)" docker compose -p prod run --rm seed
