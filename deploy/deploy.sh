#!/usr/bin/env bash
# Deploys one app image on the server. CI copies deploy/ to /srv/personal-crm and runs
#   bash deploy.sh <image> [<registry user>]
# with a short-lived GHCR token on stdin when a registry user is given.
# Order: database → migrations in a one-off container → new app → smoke /health.
# A failed step stops the script with an error; nothing is rolled back automatically
# (manual rollback: rollback.sh).
set -euo pipefail

cd "$(dirname "$0")"

APP_DOMAIN="app.lichnocrm.ru"
# Successfully deployed images, oldest first: the previous and the current one
RELEASES_FILE="releases"

image="${1:?usage: deploy.sh <image> [<registry user>]}"
registry_user="${2:-}"
export APP_IMAGE="$image"

compose() {
  docker compose -p prod "$@"
}

step() {
  echo "==> $*"
}

step "Image $image"
# Tags are commit SHAs and never change, so an image already on the server is the right one
if docker image inspect "$image" >/dev/null 2>&1; then
  echo "Already on the server"
else
  if [ -n "$registry_user" ]; then
    docker login ghcr.io --username "$registry_user" --password-stdin >/dev/null
    trap 'docker logout ghcr.io >/dev/null' EXIT
  fi
  compose pull app
fi

step "Database"
compose up --detach --wait db

step "Migrations"
# If they fail, the script stops here and the running version stays as it is
compose run --rm migrate

step "New version"
compose up --detach --wait --wait-timeout 120 app

step "Smoke test https://$APP_DOMAIN/health"
# Through nginx and HTTPS on this server, the way users reach the app
if ! curl --fail --silent --show-error --max-time 10 \
  --retry 5 --retry-delay 3 --retry-all-errors \
  --resolve "$APP_DOMAIN:443:127.0.0.1" "https://$APP_DOMAIN/health"; then
  echo >&2
  echo "SMOKE TEST FAILED: the new version is running, but /health is not OK." >&2
  echo "Nothing was rolled back." >&2
  exit 1
fi
echo

step "Cleanup: keep the current and the previous image"
{ grep --invert-match --line-regexp --fixed-strings "$image" "$RELEASES_FILE" 2>/dev/null || true
  echo "$image"; } | tail -n 2 > "$RELEASES_FILE.new"
mv "$RELEASES_FILE.new" "$RELEASES_FILE"
docker image ls "${image%:*}" --format '{{.Repository}}:{{.Tag}}' | while read -r old; do
  if ! grep --quiet --line-regexp --fixed-strings "$old" "$RELEASES_FILE"; then
    docker image rm "$old" >/dev/null || echo "Warning: could not remove $old" >&2
  fi
done
docker image prune --force >/dev/null

step "Deployed $image"
