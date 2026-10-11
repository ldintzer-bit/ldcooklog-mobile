#!/bin/bash
# Run only when asked during the controlled migration. No network access.
HERE="$(cd "$(dirname "$0")" && pwd)"
FOLDER="$HOME/Library/Mobile Documents/com~apple~CloudDocs/LDCookLog Backups"
if [ ! -d "$FOLDER" ]; then
  echo "STOP: iCloud Drive LDCookLog Backups folder was not found."
  read -r -p "Press Return to close..." reply
  exit 1
fi
SOURCE="$(find "$FOLDER" -maxdepth 1 -type f -name 'LDCookLog_*.dump' | sort | tail -n 1)"
if [ -z "$SOURCE" ]; then
  echo "STOP: No LDCookLog PostgreSQL .dump archive was found."
  read -r -p "Press Return to close..." reply
  exit 1
fi
echo "Source archive: $(basename "$SOURCE")"
echo "Creating a new private JSON file beside this archive."
echo "The original .dump and Supabase are not modified."
python3 "$HERE/convert_dump.py" "$SOURCE"
RESULT=$?
echo ""
if [ "$RESULT" -eq 0 ]; then
  echo "Conversion complete. Keep the original .dump."
  echo "Do NOT upload either private data file to GitHub."
else
  echo "Conversion failed. Original .dump is unchanged."
fi
read -r -p "Press Return to close..." reply
exit "$RESULT"
