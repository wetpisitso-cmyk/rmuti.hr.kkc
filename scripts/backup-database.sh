#!/usr/bin/env bash
# RMUTI KKC: encrypted, off-site PostgreSQL logical backup.
# Never use this script without a PRIVATE university Drive folder.
set -Eeuo pipefail
umask 077

required=(BACKUP_DATABASE_URL BACKUP_AGE_RECIPIENT BACKUP_GDRIVE_SERVICE_ACCOUNT_BASE64 BACKUP_GDRIVE_FOLDER_ID)
for key in "${required[@]}"; do
  if [[ -z "${!key:-}" ]]; then
    echo "::error::Missing backup setting: ${key}" >&2; exit 2
  fi
done
for tool in docker age rclone base64 sha256sum; do
  command -v "$tool" >/dev/null || { echo "::error::Missing tool: $tool" >&2; exit 2; }
done
if [[ ! "$BACKUP_GDRIVE_FOLDER_ID" =~ ^[A-Za-z0-9_-]{15,}$ ]]; then
  echo "::error::Invalid Drive folder ID" >&2; exit 2
fi

temp_dir="$(mktemp -d)"
cleanup() { rm -rf "$temp_dir"; }
trap cleanup EXIT
chmod 700 "$temp_dir"
printf '%s' "$BACKUP_GDRIVE_SERVICE_ACCOUNT_BASE64" | base64 --decode > "$temp_dir/service-account.json"
grep -q '"client_email"' "$temp_dir/service-account.json" || { echo "::error::Malformed service account credentials" >&2; exit 2; }
archive="$temp_dir/database.dump"
# PostgreSQL 17 archive (does not contain Google Drive objects or secrets).
DATABASE_URL="$BACKUP_DATABASE_URL" docker run --rm \
  --user "$(id -u):$(id -g)" \
  --env DATABASE_URL \
  --volume "$temp_dir:/backup:rw" \
  postgres:17-alpine \
  sh -ec 'exec pg_dump --dbname="$DATABASE_URL" --format=custom --no-owner --no-acl --file=/backup/database.dump'
docker run --rm --user "$(id -u):$(id -g)" \
  --volume "$temp_dir:/backup:ro" postgres:17-alpine \
  pg_restore --list /backup/database.dump > "$temp_dir/archive-list.txt"
test -s "$temp_dir/archive-list.txt"
test -s "$archive"
stamp="$(date -u +%Y-%m-%dT%H-%M-%SZ)"
filename="rmuti-kkc-db-$stamp.dump.age"
age -r "$BACKUP_AGE_RECIPIENT" -o "$temp_dir/$filename" "$archive"
test -s "$temp_dir/$filename"
(cd "$temp_dir" && sha256sum "$filename" > "$filename.sha256")
export RCLONE_CONFIG_RMUTIBACKUP_TYPE="drive"
export RCLONE_CONFIG_RMUTIBACKUP_SCOPE="drive"
export RCLONE_CONFIG_RMUTIBACKUP_SERVICE_ACCOUNT_FILE="$temp_dir/service-account.json"
export RCLONE_CONFIG_RMUTIBACKUP_ROOT_FOLDER_ID="$BACKUP_GDRIVE_FOLDER_ID"
rclone copyto "$temp_dir/$filename" "rmutibackup:$filename" --retries 3
rclone copyto "$temp_dir/$filename.sha256" "rmutibackup:$filename.sha256" --retries 3
rclone check "$temp_dir" "rmutibackup:" --one-way \
  --include "$filename" --include "$filename.sha256"
if [[ -n "${GITHUB_STEP_SUMMARY:-}" ]]; then
  {
    echo "### RMUTI KKC encrypted database backup"
    echo "- Backup UTC: $stamp"
    echo "- Archive inspection: pg_restore --list passed"
    echo "- Encrypted remote SHA-256: uploaded; rclone check passed"
    echo "- Isolated restore: NOT YET VERIFIED"
    echo "- No database dumps stored in GitHub artifacts"
  } >> "$GITHUB_STEP_SUMMARY"
fi
echo "Encrypted off-site database backup uploaded and checked: $stamp"
