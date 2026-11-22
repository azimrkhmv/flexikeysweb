# FlexiKeys production server

One Linux server in Tashkent runs everything with Docker Compose (`compose.prod.yml`): Caddy (HTTPS), the website
(live mode), the server (`apps/api`) and its background worker, PostgreSQL, Redis and MinIO (file storage). Real
children's data stays on this server, in Uzbekistan. The Vercel demo (`demo.flexikeys.org`) is separate: mock mode,
no server, see `apps/web/DEPLOY-VERCEL.md`.

| Address | Goes to |
|---|---|
| `https://flexikeys.org` | the website; `/api/v1` on it goes to the server (the website's own calls) |
| `https://www.flexikeys.org` | a redirect to `https://flexikeys.org` |
| `https://api.flexikeys.org` | the server (mobile app later, load test, `/healthz`) |
| `https://files.flexikeys.org` | MinIO, for signed upload and download links (up to 500 MB per upload) |

Only Caddy publishes ports (80 and 443). Docker opens a published port to the internet past the server's firewall,
so never add a `ports:` line to another service. To look into the database, use `docker compose exec` (below).

## First start

1. A server with Ubuntu 24.04, Docker and the Compose plugin (`curl -fsSL https://get.docker.com | sh`), `git` and
   `rsync`. Firewall: allow 22, 80 and 443 only (`ufw allow OpenSSH; ufw allow 80; ufw allow 443/tcp; ufw allow
   443/udp; ufw enable`).
2. DNS: `flexikeys.org`, `www`, `api` and `files` point at the server's address (A records).
3. Clone and configure:
   ```bash
   git clone https://github.com/azimrkhmv/flexikeysweb.git && cd flexikeysweb/deploy
   cp .env.prod.example .env && chmod 600 .env
   nano .env      # every empty value; secrets with: openssl rand -base64 48
   ```
   `HEALTH_KEYS`: make it as `docs/health-key.md` says and keep a copy outside the server. Without it the health
   answers in a backup cannot be read.
4. Start: `./deploy.sh`. The first build takes several minutes. Caddy gets the certificates when the first request
   comes in.
5. First admin: `docker compose -f compose.prod.yml exec api python -m app.cli create-admin +998…` (it prints the
   key for the authenticator app). Then the exercise library and daily questions:
   `docker compose -f compose.prod.yml exec api python -m app.cli load-exercises`, `… load-daily-questions`,
   `… load-kits`.
6. Backups every night: `crontab -e` and add the line at the top of `backup.sh`.

**Before real families: a real SMS provider (B121).** With `ENV=prod` the server refuses the simulated SMS (it
would show sign-in codes on screen to anyone). Until Eskiz is connected the server only starts with `ENV=dev`,
which is fine for a test but not for families.

## Update

```bash
cd ~/flexikeysweb/deploy && ./deploy.sh
```

It pulls `main`, builds, runs the database changes once (`alembic upgrade head`), keeps the bucket private, starts
everything and prints the server's health check. It stops at the first error; the old containers keep running until
the new ones are built.

## Roll back to the previous commit

```bash
cd ~/flexikeysweb
git log --oneline -5                 # find the commit to go back to
git checkout <commit>                # the code only; the database stays as it is
cd deploy && docker compose -f compose.prod.yml up -d --build --wait
git checkout main                    # afterwards, so the next ./deploy.sh pulls again
```

Database changes are never undone automatically. If the bad update had a migration, restore last night's backup
(below) or ask the developer for a downgrade; never edit a pushed migration.

## Logs

```bash
docker compose -f compose.prod.yml ps                       # what runs, and the health of api and postgres
docker compose -f compose.prod.yml logs -f --tail 200 api   # also: web, worker, caddy, postgres, minio
docker compose -f compose.prod.yml exec postgres psql -U flexikeys flexikeys
```

## Backups

`backup.sh` writes `~/backups/<date>/` (`db.sql.gz`, `files.tar.gz`, `commit.txt`), keeps 14 days and copies the
folder to `BACKUP_TARGET` (another machine, `user@host:/path`, rsync over SSH with a key and no password). The
backup holds health answers encrypted with `HEALTH_KEYS`; keep that key apart from the backups.

## Restore a backup

Test it (do this once a month): `./restore.sh 2026-11-22` loads that day into a **fresh** database
(`flexikeys_restore_2026_11_22`) and prints the migration and the number of accounts and children. The live database
is not touched. `--files` also unpacks the files to look at them.

Use it for real (the database is lost):
```bash
docker compose -f compose.prod.yml stop api worker web
gunzip -c ~/backups/<date>/db.sql.gz | docker compose -f compose.prod.yml exec -T postgres psql -U flexikeys flexikeys
docker compose -f compose.prod.yml exec -T minio sh -c 'mkdir -p /tmp/r && tar -C /tmp/r -xzf - &&
  mc alias set fk http://localhost:9000 "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD" && mc mirror /tmp/r/flexikeys fk/flexikeys' \
  < ~/backups/<date>/files.tar.gz
git -C .. checkout "$(cat ~/backups/<date>/commit.txt)" && ./deploy.sh   # or stay on main if it has no new migration
```

## Test the whole thing on your own computer

Set `DOMAIN=localhost`, `SITE_URL=https://localhost`, `CORS_ORIGINS=https://localhost`,
`S3_PUBLIC_ENDPOINT=https://files.localhost`, `FK_STORAGE_ORIGIN=https://files.localhost`, `ENV=dev` in `.env`,
then `./deploy.sh` (on Windows: the commands in it by hand). Caddy makes its own certificates for `localhost`;
the browser warns once per address (open `https://files.localhost` once and accept, or uploads fail).

## Load test (B120)

`loadtest.mjs` signs up 50 parents at once. It needs a test sign-in that skips the SMS:

> **Warning.** `FK_LOADTEST_SECRET` turns on a sign-in without SMS for the numbers `+998 00 …` (no real phone has
> them). Set it only for the test, then **empty it and run `./deploy.sh` again**. While it is set, anyone who knows
> the secret can make accounts without a phone.

```bash
node loadtest.mjs                         # against https://localhost (the local stack)
node loadtest.mjs --production            # against https://flexikeys.org; refuses without --production
node loadtest-cleanup.mjs [--production]  # deletes every load-test account and its data
```
Both read `FK_LOADTEST_SECRET` from the environment.
