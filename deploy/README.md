# Production deployment (one server)

Everything runs on one small Linux server with Docker: PostgreSQL, the API,
and Caddy (serves the web app, gets the HTTPS certificate, forwards `/api` to
the API), plus a nightly backup. Built for Oracle Cloud "Always Free"
(Ampere A1, ARM) but works on any Ubuntu VM.

Local development does **not** use this - it stays on Aspire.

## 1. Server (Oracle Cloud)

1. Create a VM: Compute → Instances → Create. Image **Ubuntu 24.04**, shape
   **VM.Standard.A1.Flex** (Ampere) - e.g. 2 OCPU / 12 GB (free up to 4 / 24).
   Add your SSH public key. Boot volume 50-100 GB (free up to 200 GB total).
2. Keep it from being reclaimed as idle: with a Pay As You Go account it never
   is (Always Free resources stay free; set a budget alert of $1).
3. Open the ports: the instance's subnet → Security List → Add Ingress Rules:
   source `0.0.0.0/0`, TCP, destination ports `80,443` (and UDP 443 for HTTP/3).
4. Point your domain at it: an **A record** (e.g. `planner.example.com`) →
   the instance's public IP. Caddy needs this before it can get a certificate.

## 2. First deploy

```bash
ssh ubuntu@<server-ip>
git clone https://github.com/<you>/aiPlanner.git && cd aiPlanner
sudo bash deploy/setup-server.sh   # Docker, firewall, auto updates
exit                               # log in again so the docker group applies

cd aiPlanner/deploy
cp .env.example .env
nano .env                          # DOMAIN, passwords (openssl rand -base64 48), OpenAI key, ALLOWED_EMAILS
docker compose up -d --build       # first build takes a few minutes
docker compose logs -f api         # "Now listening on: http://[::]:8080"
```

Open `https://<your domain>` and sign up with an address from `ALLOWED_EMAILS`.
The database schema is created on start (`Database__MigrateOnStartup`).

## 3. Updates

```bash
cd ~/aiPlanner && git pull
cd deploy && docker compose up -d --build
```

Migrations run when the new API starts.

## Staging (try it before production)

A second copy of the app on the same server: **https://staging.gatazee.com**,
with its own database, recordings and settings (`deploy/.env.staging`), no
backups, sign-up limited to the owner, a STAGING ribbon on every page and
`noindex`. It is `compose.staging.yaml` (project `gatazee-staging`, checkout
`~/gatazee-staging`); production's Caddy owns ports 80/443 and forwards
`STAGING_DOMAIN` to it over the shared `gatazee-edge` network.

The flow - production only ever gets a commit that ran on staging:

```bash
git push                                  # as usual
bash tools/deploy.sh staging              # this commit -> staging; try it there
bash tools/deploy.sh production --yes     # what staging runs -> production
bash tools/deploy.sh status               # which commit each one runs
```

`production` moves the `production` branch to staging's commit (fast-forward
only) and the server's `~/aiplanner` checkout follows that branch.

First-time setup (done 2026-10-31):
1. DNS: an A record `staging` -> the server's IP.
2. `bash tools/deploy.sh init-staging` - clones `~/gatazee-staging` and writes
   `.env.staging` with new secrets (the OpenAI key copied from production's).
3. `STAGING_DOMAIN=staging.gatazee.com` in production's `deploy/.env`, then a
   production deploy (its Caddy learns the address).
4. `bash tools/deploy.sh staging`.

Optional on staging (empty = off): email codes, web push, Google sign-in (add
`https://staging.gatazee.com` to the Web client's JavaScript origins first).
A staging APK: the release build with `-PstagingApp` and
`EXPO_PUBLIC_API_URL=https://staging.gatazee.com` - "Gatazee Staging", package
`com.aiplanner.app.staging` (`mobile/plugins/withStagingVariant.js`), so it installs next to
the real app. Download it from the staging site's `/dl/` (copied into the staging web container,
gone after a staging rebuild - copy it again).

## Backups

The `backup` service writes `db-<date>.sql.gz` and `recordings-<date>.tgz`
into the `aiplanner_backups` volume every 24 h and keeps 14 days. They are on
the same disk - copy them off now and then:

```bash
scp -r ubuntu@<server-ip>:/var/lib/docker/volumes/aiplanner_backups/_data ./backups   # needs sudo on the server, or:
docker run --rm -v aiplanner_backups:/b -v "$PWD":/out alpine cp -r /b /out/backups
```

**Off the server (`offsite` service):** with `B2_KEY_ID`, `B2_APP_KEY`,
`B2_BUCKET` and `BACKUP_PASSPHRASE` in `.env`, every night's files are copied
to Backblaze B2, encrypted on the server first (rclone crypt: neither the data
nor the file names are readable there); copies older than 30 days are removed.
`docker compose logs offsite` shows "offsite: copied" each night. To get them
back (any machine with rclone):

```bash
export RCLONE_CONFIG_B2_TYPE=b2 RCLONE_CONFIG_B2_ACCOUNT=<key id> RCLONE_CONFIG_B2_KEY=<app key>
export RCLONE_CONFIG_SECURE_TYPE=crypt RCLONE_CONFIG_SECURE_REMOTE=b2:<bucket>/gatazee
export RCLONE_CONFIG_SECURE_PASSWORD=$(rclone obscure '<BACKUP_PASSPHRASE>')
rclone ls secure:                      # what's there
rclone copy secure: ./restored          # all of it, decrypted
```

Restore a dump into an empty database:

```bash
gunzip -c db-2026-10-06.sql.gz | docker compose exec -T postgres psql -U postgres -d aiplannerdb
```

## Moving existing data to the server (optional)

```bash
# on your PC (database from the Aspire "postgres" resource)
pg_dump "<connection string>" --no-owner | gzip > aiplanner.sql.gz
scp aiplanner.sql.gz ubuntu@<server-ip>:
# on the server, before anyone signs up
docker compose stop api
docker compose exec -T postgres psql -U postgres -c "DROP DATABASE aiplannerdb" -c "CREATE DATABASE aiplannerdb"
gunzip -c ~/aiplanner.sql.gz | docker compose exec -T postgres psql -U postgres -d aiplannerdb
docker compose start api
```

Recordings live in `backend/src/AiPlanner.Api/App_Data/voice-captures`; copy
them into the `aiplanner_recordings` volume under `voice-captures/` the same
way (`docker run ... alpine cp`).

## Mobile app against the server

The phone app needs the server's address at build time:

```powershell
cd mobile\android
$env:EXPO_PUBLIC_API_URL = 'https://planner.example.com'; $env:NODE_ENV = 'production'
.\gradlew.bat assembleRelease "-Dorg.gradle.jvmargs=-Xmx4g -XX:MaxMetaspaceSize=1g" -PreactNativeArchitectures=arm64-v8a
# -> android\app\build\outputs\apk\release\app-release.apk (~47 MB)
```

The default 2 GB Gradle heap runs out while packaging (`OutOfMemoryError` in
mergeDexRelease); arm64 only covers every phone from the last ~8 years and
builds much faster. The APK is signed with the debug key - fine for
installing it yourself, and it installs over the development build (same
package and key). Google Play would need a real upload key.

The web app needs nothing - it calls `/api` on its own address. It can be
installed to the home screen from the browser (PWA).

## Settings (`.env`)

| Variable | What |
|---|---|
| `DOMAIN` | the address; Caddy gets its certificate |
| `POSTGRES_PASSWORD`, `JWT_SECRET` | long random strings; don't change `JWT_SECRET` later (signs everyone out) |
| `OPENAI_API_KEY` | your key |
| `ALLOWED_EMAILS` | who may sign up (comma-separated); empty = anyone |
| `AI_PER_DAY` | captures per user per day (also 30 per 10 min) |

Sign-in is limited to 20 attempts per minute per IP address.
