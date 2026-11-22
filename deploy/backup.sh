#!/usr/bin/env bash
# Back up the database and the files (B111) into ~/backups/<date>/, keep 14 days, copy to BACKUP_TARGET.
# Run on the server from cron every night, for example:
#   15 3 * * *  /home/flexikeys/flexikeysweb/deploy/backup.sh >> /home/flexikeys/backups/backup.log 2>&1
set -euo pipefail
cd "$(dirname "$0")"
set -a; . ./.env; set +a

COMPOSE=(docker compose -f compose.prod.yml)
ROOT="${BACKUP_ROOT:-$HOME/backups}"
DAY="$(date +%Y-%m-%d)"
DIR="$ROOT/$DAY"
mkdir -p "$DIR"
chmod 700 "$ROOT"

echo "== $(date -Is) database -> $DIR/db.sql.gz"
"${COMPOSE[@]}" exec -T postgres pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --no-owner --clean --if-exists \
  | gzip -9 > "$DIR/db.sql.gz.part"
mv "$DIR/db.sql.gz.part" "$DIR/db.sql.gz"

echo "== files (bucket $S3_BUCKET) -> $DIR/files.tar.gz"
# A copy of the bucket made inside the MinIO container with its own client, then streamed out as one archive.
"${COMPOSE[@]}" exec -T minio sh -c \
  'rm -rf /tmp/fk-backup && mc alias set fk http://localhost:9000 "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD" >/dev/null &&
   mc mirror --quiet "fk/$0" /tmp/fk-backup/"$0" >/dev/null && tar -C /tmp/fk-backup -czf - . && rm -rf /tmp/fk-backup' \
  "$S3_BUCKET" > "$DIR/files.tar.gz.part"
mv "$DIR/files.tar.gz.part" "$DIR/files.tar.gz"

git -C .. rev-parse HEAD > "$DIR/commit.txt" # the code that matches this database
ls -lh "$DIR"

echo "== keep 14 days"
find "$ROOT" -mindepth 1 -maxdepth 1 -type d -name '20??-??-??' -mtime +13 -print -exec rm -rf {} +

if [ -n "${BACKUP_TARGET:-}" ]; then
  echo "== copy to $BACKUP_TARGET"
  rsync -a --delete -e "ssh -o BatchMode=yes" "$ROOT/" "$BACKUP_TARGET/"
else
  echo "BACKUP_TARGET is empty: the backup is on this server only" >&2
fi
echo "== done"
