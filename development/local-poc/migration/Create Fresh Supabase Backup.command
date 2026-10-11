#!/bin/bash
# Interim safeguard while the existing Supabase app remains in use.
# This creates a NEW read-only PostgreSQL export; it never overwrites old dumps.
set -u
set -o pipefail
FOLDER="$HOME/Library/Mobile Documents/com~apple~CloudDocs/LDCookLog Backups"
PG_DIR="/opt/homebrew/opt/libpq/bin"
CONN="host=aws-0-us-east-1.pooler.supabase.com port=5432 dbname=postgres user=postgres.ogfzgeuavfnuuzcwzwqx sslmode=require"
TEMP=""
finish() {
  if [ -n "$TEMP" ] && [ -f "$TEMP" ]; then rm -f -- "$TEMP"; fi
  echo ""
  read -r -p "Press Return to close this window..." reply
}
trap finish EXIT
if [ ! -d "$FOLDER" ]; then
  echo "STOP: The iCloud Drive backup folder is unavailable. No backup was attempted."
  exit 1
fi
if [ ! -x "$PG_DIR/pg_dump" ] || [ ! -x "$PG_DIR/pg_restore" ]; then
  echo "STOP: PostgreSQL libpq tools were not found. No backup was attempted."
  exit 1
fi
umask 077
NAME="LDCookLog_$(date +%Y-%m-%d_%H%M%S).dump"
OUTPUT="$FOLDER/$NAME"
TEMP=$(mktemp "$FOLDER/.LDCookLog_incomplete_XXXXXXXX") || exit 1
echo "Making a NEW private read-only backup in iCloud Drive."
echo "When prompted for Password, paste the DATABASE password from 1Password."
echo "The password will not appear on screen or be stored by this script."
if ! "$PG_DIR/pg_dump" --dbname="$CONN" --format=custom --schema=public --no-owner --no-privileges --password --file="$TEMP"; then
  echo "BACKUP FAILED. Original databases and previous backup files remain unchanged."
  exit 1
fi
if ! "$PG_DIR/pg_restore" --list "$TEMP" >/dev/null || ! "$PG_DIR/pg_restore" --file=/dev/null "$TEMP"; then
  echo "BACKUP VERIFICATION FAILED. The incomplete file will be discarded."
  exit 1
fi
TABLES=$("$PG_DIR/pg_restore" --list "$TEMP" | grep -c ' TABLE DATA public ')
if [ "$TABLES" -lt 18 ]; then
  echo "BACKUP VERIFICATION FAILED: Only $TABLES public table-data sections found; expected at least 18."
  exit 1
fi
COOKS=$("$PG_DIR/pg_restore" --data-only --table=cooks --file=- "$TEMP" | awk '
  /^COPY public\.cooks[[:space:]]/ {reading=1;found=1;next}
  reading && $0=="\\." {reading=0;next}
  reading {rows++}
  END { if (!found) exit 1; print rows+0 }
') || { echo "COOK COUNT VERIFICATION FAILED."; exit 1; }
if [ "$COOKS" -lt 30 ]; then
  echo "BACKUP VERIFICATION FAILED: $COOKS cooks found, fewer than the known 30."
  exit 1
fi
mv -- "$TEMP" "$OUTPUT" || { echo "Could not finalize backup file."; exit 1; }
TEMP=""
echo ""
echo "BACKUP CREATED AND VERIFIED"
echo "Public tables: $TABLES"
echo "Cook records: $COOKS"
echo "File: $OUTPUT"
ls -lh "$OUTPUT"
echo "Check Finder to ensure iCloud upload finishes."
