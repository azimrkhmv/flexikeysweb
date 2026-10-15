# The health key

The server encrypts every health answer (diagnosis, safety, equipment, …) with one secret key, `HEALTH_KEYS`
(`apps/api/app/crypto.py`). Without that key, nobody can read them — **including us**. If the key is lost, every
health answer in the database is lost for good. So the key has one rule: **always two copies, in two places.**

## What the key looks like

A line of 44 letters, numbers, `-` and `_`, ending with `=`. Make a new one with:

```
cd apps/api && uv run python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

`HEALTH_KEYS` can hold several keys separated by commas. The **first** one encrypts new answers; **all** of them can
read old ones. That is how a key is changed without losing data (see "Changing the key").

## Where the key lives

| Place | Which key | Who sets it |
|---|---|---|
| A developer's computer | the public dev key in `apps/api/.env.example`, copied to `.env` | anyone |
| Tests | the same dev key, in `apps/api/tests/conftest.py` | — |
| Test server (A0.7) | its own key, set as a secret environment variable on the host | Azim |
| Production | its own key, set as a secret environment variable on the host — **never in git, chat or email** | Azim |

The production server refuses to start with the public dev key.

**Open decision:** the production host is not chosen yet (TASKS.md `Q4`). When it is, write the exact place here
(for example "Contabo VPS, `/etc/flexikeys/api.env`, readable only by the `flexikeys` user").

## Backup

Two copies, kept apart, so one lost laptop or one forgotten password does not lose the key:

1. **Password manager** shared by Azim and one founder (proposal: Bitwarden Organization, item "FlexiKeys health
   key — production"). Store the key and the date it was made.
2. **Paper**, printed once, in a sealed envelope, kept by a founder at the office or at home in a safe place.

**Open decision:** who is the second keeper, and which password manager. Write the names here when decided.

The database backup and the key must never be stored together. A stolen backup is harmless without the key.

## Restore test (TASKS.md `A2.6`)

Proves that a backup plus the backed-up key gives back readable health answers — on a computer that never had the
key before. Do it once now, then every 6 months and after every key change.

On the **current** computer (or server):

```
cd apps/api
docker compose exec -T db pg_dump -U flexikeys -Fc flexikeys > flexikeys.dump
```

Move `flexikeys.dump` to the **other** computer (for example Bekzod's laptop) by a private way. On that computer, with
the repository and Docker ready:

```
cd apps/api
cp .env.example .env
# Put the key FROM THE BACKUP (password manager or paper) into .env: HEALTH_KEYS=...
docker compose up -d --wait db
docker compose exec -T db pg_restore -U flexikeys -d flexikeys --clean --if-exists < flexikeys.dump
uv run python -m app.cli check-health-key
```

Passed when it prints `N of N health answers readable with this key.` with N above 0. Write the date and the result
below, then delete the dump file on both computers.

| Date | Other computer | Result |
|---|---|---|
| 2026-10-16 | rehearsal only: same Mac, test data, fresh database | 5 of 5 readable; a wrong key: 0 of 5, refused |

## Changing the key

1. Make a new key (command above) and back it up (both copies) **first**.
2. Set `HEALTH_KEYS=<new key>,<old key>` and restart the server. New answers use the new key; old ones still read.
3. Old answers stay on the old key until a re-encryption job exists (none yet; add a task when needed). So the old key
   stays in `HEALTH_KEYS` and in the backup.

## If the key leaks

The leaked key plus a copy of the database reveals health answers. Make a new key at once (above), tell the founders
the same day, and plan re-encryption of the old answers with the new key.
