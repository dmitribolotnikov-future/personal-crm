#!/usr/bin/env bash
# Manual restore on the server: bash restore.sh <backup.dump>
# Replaces only the prod database and restarts the same app container without migrations.
set -euo pipefail

if [ "$#" -ne 1 ]; then
  echo "Usage: bash restore.sh <backup.dump>" >&2
  exit 1
fi
backup_file="$(realpath -e -- "$1")"
if [ ! -f "$backup_file" ] || [ ! -r "$backup_file" ] || [ ! -s "$backup_file" ]; then
  echo "Backup must be a readable, nonempty regular file: $backup_file" >&2
  exit 1
fi

cd "$(dirname "$0")"
source ./database.sh
lock_operations
current_app
export APP_IMAGE="$current_image"

database="$(compose exec -T db sh -eu -c 'printf "%s\n" "$POSTGRES_DB"' < /dev/null)"
case "$database" in
  ""|postgres|template0|template1)
    echo "Refusing to replace a missing or maintenance database." >&2
    exit 1
    ;;
esac

step "Validate backup $backup_file"
validate_backup "$backup_file"

echo "Backup file: $backup_file"
echo "Database to DELETE and recreate: $database (Compose project: prod, service: db)"
echo "App version to keep: $current_image"
echo "A safety backup of the current database will be saved before replacement."
if [ ! -t 0 ]; then
  echo "Restore requires an interactive terminal. Connect to the server and run it manually." >&2
  exit 1
fi
if ! read -r -p 'Type yes to replace this database: ' confirmation || [ "$confirmation" != yes ]; then
  echo "Restore cancelled. No database changes were made."
  exit 1
fi

step "Safety backup before restore"
backup_database "$current_image" pre-restore

app_stopped=false
restore_exit() {
  local status="$?"
  if [ "$status" -ne 0 ] && [ "$app_stopped" = true ]; then
    echo "RESTORE FAILED after stopping the app. No automatic recovery was attempted." >&2
    echo "Safety backup: $BACKUP_FILE" >&2
    echo "Inspect the error before attempting another manual restore." >&2
  fi
}
trap restore_exit EXIT

step "Stop the current app"
compose stop app
app_stopped=true

step "Delete and recreate database $database"
compose exec -T db sh -eu -c '
  dropdb --no-password --username="$POSTGRES_USER" --maintenance-db=postgres --force -- "$POSTGRES_DB"
  createdb --no-password --username="$POSTGRES_USER" --maintenance-db=postgres \
    --template=template0 --owner="$POSTGRES_USER" -- "$POSTGRES_DB"
' < /dev/null

step "Restore database from $backup_file"
compose exec -T db sh -eu -c '
  pg_restore --no-password --username="$POSTGRES_USER" --dbname="$POSTGRES_DB" \
    --exit-on-error --single-transaction
' < "$backup_file"

step "Start the same app version $current_image"
# start reuses the existing container; it never pulls or creates an app image.
compose start --wait --wait-timeout 120 app
app_stopped=false

step "Smoke test https://app.lichnocrm.ru/health"
if ! curl --fail --silent --show-error --max-time 10 \
  --retry 5 --retry-delay 3 --retry-all-errors \
  --resolve app.lichnocrm.ru:443:127.0.0.1 https://app.lichnocrm.ru/health; then
  echo >&2
  echo "SMOKE TEST FAILED after restore. The same app version is running; nothing was rolled back." >&2
  exit 1
fi
echo
step "Restored $database; app version unchanged: $current_image"
