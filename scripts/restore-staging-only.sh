#!/usr/bin/env bash
# OFFLINE / STAGING ONLY: decrypt a private .age backup and rehearse restore.
# This script explicitly blocks production and requires a typed confirmation.
set -Eeuo pipefail
umask 077
prod_ref="rioukmxrgaknayltxxyk"
: "${ENCRYPTED_BACKUP_FILE:?Path to private encrypted backup required}"
: "${AGE_IDENTITY_FILE:?Path to private age identity file required}"
: "${STAGING_DATABASE_URL:?Separate staging connection required}"
: "${STAGING_PROJECT_REF:?Staging Supabase project ref required}"
: "${RESTORE_STAGING_CONFIRM:?Typed staging-only restore confirmation required}"
if [[ "$STAGING_PROJECT_REF" == "$prod_ref" ||
      "$STAGING_DATABASE_URL" == *"$prod_ref"* ||
      "$STAGING_PROJECT_REF" == "" ||
      "$STAGING_DATABASE_URL" != *"$STAGING_PROJECT_REF"* ||
      "$RESTORE_STAGING_CONFIRM" != "RESTORE_ISOLATED_STAGING_ONLY" ]]; then
  echo "REFUSED: restore requires a different project reference and exact confirmation" >&2
  exit 3
fi
[[ -f "$ENCRYPTED_BACKUP_FILE" ]] || { echo "Archive not found" >&2; exit 2; }
[[ -f "$AGE_IDENTITY_FILE" ]] || { echo "Identity not found" >&2; exit 2; }
command -v age >/dev/null
command -v docker >/dev/null
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
chmod 700 "$tmp"
age --decrypt --identity "$AGE_IDENTITY_FILE" \
  --output "$tmp/database.dump" "$ENCRYPTED_BACKUP_FILE"
docker run --rm --user "$(id -u):$(id -g)" \
  --volume "$tmp:/backup:ro" postgres:17-alpine \
  pg_restore --list /backup/database.dump > "$tmp/archive-list.txt"
test -s "$tmp/archive-list.txt"
echo "Archive index verified. Restoring ONLY to isolated staging project $STAGING_PROJECT_REF."
# DESTRUCTIVE IN STAGING: must never be passed a production connection string.
DATABASE_URL="$STAGING_DATABASE_URL" docker run --rm \
  --user "$(id -u):$(id -g)" \
  --env DATABASE_URL \
  --volume "$tmp:/backup:ro" postgres:17-alpine \
  sh -ec 'exec pg_restore --dbname="$DATABASE_URL" --clean --if-exists --no-owner --no-acl --exit-on-error /backup/database.dump'
echo "Staging pg_restore completed. Follow the documented identity, RLS and Drive verification checklist."
