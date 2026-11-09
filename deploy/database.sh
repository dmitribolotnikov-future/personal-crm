#!/usr/bin/env bash
# Shared production database helpers. Source from scripts running in this directory.

umask 077

compose() {
  docker compose -p prod "$@"
}

step() {
  echo "==> $*"
}

lock_operations() {
  # Deploy and restore must never change the production stack at the same time.
  exec 9>operations.lock
  if ! flock --nonblock 9; then
    echo "Another deploy or restore is running. Try again after it finishes." >&2
    exit 1
  fi
}

current_app() {
  # releases records successful deploys; the actual container can be newer after a failure.
  app_container="$(docker ps --all \
    --filter label=com.docker.compose.project=prod \
    --filter label=com.docker.compose.service=app \
    --filter label=com.docker.compose.oneoff=False \
    --format '{{.ID}}')"
  if [ -z "$app_container" ] || [[ "$app_container" == *$'\n'* ]]; then
    echo "Expected one existing prod app container; cannot determine its version." >&2
    exit 1
  fi
  current_image="$(docker inspect --type container --format '{{.Config.Image}}' "$app_container")"
}

validate_backup() {
  # Read the entire archive, including compressed data, without executing its SQL.
  compose exec -T db pg_restore --exit-on-error --file=/dev/null < "$1"
}

backup_database() {
  local source_image="$1" purpose="$2" version timestamp partial
  version="${source_image##*:}"
  if [[ ! "$version" =~ ^[a-zA-Z0-9][a-zA-Z0-9_.-]*$ ]]; then
    echo "Cannot use the current image version in a backup filename." >&2
    return 1
  fi

  timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
  install -d -m 700 backups
  partial="$(mktemp "$PWD/backups/${timestamp}_${version}_${purpose}_XXXXXX.dump.partial")"

  # Credentials stay inside the database container; never read or print .env.
  # Do not consume deploy.sh's stdin: it carries the short-lived registry token.
  if ! compose exec -T db sh -eu -c '
    pg_dump --no-password --username="$POSTGRES_USER" --dbname="$POSTGRES_DB" --format=custom
  ' < /dev/null > "$partial"; then
    rm -f -- "$partial"
    echo "Database backup failed. No database changes were made." >&2
    return 1
  fi
  if ! validate_backup "$partial"; then
    rm -f -- "$partial"
    echo "Backup archive validation failed. No database changes were made." >&2
    return 1
  fi

  # Only publish complete archives. mktemp prevents collisions on repeat runs.
  BACKUP_FILE="${partial%.partial}"
  mv -- "$partial" "$BACKUP_FILE"
  echo "Backup saved: $BACKUP_FILE"
}
