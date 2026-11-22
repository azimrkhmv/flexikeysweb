#!/usr/bin/env bash
# Restore one day's backup into a FRESH database, to test that the backup works (B111). The live database is never
# touched: the copy goes into a new database named flexikeys_restore_<date> in the same PostgreSQL.
#   ./restore.sh 2026-11-22            # database only
#   ./restore.sh 2026-11-22 --files    # also unpack the files into ~/backups/<date>/files/ to look at them
# Using a restored copy for real (after a disaster) is a manual step on purpose: see README.md "Restore a backup".
set -euo pipefail
cd "$(dirname "$0")"
set -a; . ./.env; set +a

DAY="${1:?usage: ./restore.sh <YYYY-MM-DD> [--files]}"
DIR="${BACKUP_ROOT:-$HOME/backups}/$DAY"
[ -f "$DIR/db.sql.gz" ] || { echo "no backup at $DIR" >&2; exit 1; }
COMPOSE=(docker compose -f compose.prod.yml)
NAME="flexikeys_restore_${DAY//-/_}"
PSQL=("${COMPOSE[@]}" exec -T postgres psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER")

echo "== fresh database $NAME"
"${PSQL[@]}" -d postgres -c "DROP DATABASE IF EXISTS $NAME" -c "CREATE DATABASE $NAME"
echo "== load $DIR/db.sql.gz"
gunzip -c "$DIR/db.sql.gz" | "${PSQL[@]}" -q -d "$NAME" >/dev/null
echo "== check"
"${PSQL[@]}" -d "$NAME" -c "SELECT version_num AS migration FROM alembic_version" \
  -c "SELECT count(*) AS accounts FROM users" -c "SELECT count(*) AS children FROM children"

if [ "${2:-}" = "--files" ]; then
  mkdir -p "$DIR/files" && tar -C "$DIR/files" -xzf "$DIR/files.tar.gz"
  echo "files unpacked into $DIR/files ($(find "$DIR/files" -type f | wc -l) files)"
fi
echo "Done. Remove the copy when finished: docker compose -f compose.prod.yml exec postgres dropdb -U $POSTGRES_USER $NAME"
