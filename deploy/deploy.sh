#!/usr/bin/env bash
# Update the production server to the latest main (B111): pull, build, database changes once, start, health check.
# Run on the server from the deploy/ folder: ./deploy.sh   (stops at the first error)
set -euo pipefail
cd "$(dirname "$0")"

COMPOSE=(docker compose -f compose.prod.yml)
[ -f .env ] || { echo "deploy/.env is missing: cp .env.prod.example .env and fill it in" >&2; exit 1; }
set -a; . ./.env; set +a

echo "== git pull"
git pull --ff-only
echo "   now at $(git log --oneline -1)"

echo "== build"
"${COMPOSE[@]}" build

echo "== database changes (alembic upgrade head)"
"${COMPOSE[@]}" up -d --wait postgres redis minio
"${COMPOSE[@]}" run --rm --no-deps api alembic upgrade head

echo "== file storage: bucket ${S3_BUCKET} exists and is private"
"${COMPOSE[@]}" exec -T minio sh -c \
  'mc alias set fk http://localhost:9000 "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD" >/dev/null &&
   mc mb --ignore-existing "fk/$0" >/dev/null && mc anonymous set none "fk/$0"' "$S3_BUCKET"

echo "== start"
"${COMPOSE[@]}" up -d --remove-orphans --wait

echo "== health check"
"${COMPOSE[@]}" exec -T api python -c \
  "import urllib.request; print(urllib.request.urlopen('http://localhost:8000/healthz').read().decode())"
echo "Done. From outside: curl https://api.${DOMAIN}/healthz"
