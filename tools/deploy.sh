#!/usr/bin/env bash
# Staging first, then production (2026-10-31). See deploy/README.md "Staging".
#
#   bash tools/deploy.sh staging [commit]   # a pushed commit (default: this HEAD) -> https://staging.gatazee.com
#   bash tools/deploy.sh production --yes    # exactly what staging runs now -> https://app.gatazee.com
#   bash tools/deploy.sh status              # which commit each one runs
#   bash tools/deploy.sh init-staging        # once: the staging checkout + its .env.staging
#
# Production never takes a commit that wasn't on staging first: it moves the
# "production" branch (fast-forward only) to staging's commit and deploys that.
set -euo pipefail

SERVER=${GATAZEE_SERVER:-ubuntu@158.178.130.115}
KEY=${GATAZEE_SSH_KEY:-$HOME/Downloads/ssh-key-2026-10-06.key}
PROD_DIR=aiplanner
STAGING_DIR=gatazee-staging
on_server() { ssh -o ConnectTimeout=15 -i "$KEY" "$SERVER" "$@"; }
cd "$(dirname "$0")/.."

case "${1:-}" in
  init-staging)
    # A second checkout (cloned from production's, same origin) and a .env.staging with
    # new secrets; the OpenAI key is copied from production's .env on the server - nothing
    # secret leaves the server or gets printed.
    on_server "set -e
      docker network inspect gatazee-edge >/dev/null 2>&1 || docker network create gatazee-edge >/dev/null
      if [ ! -d ~/$STAGING_DIR ]; then
        git clone -q ~/$PROD_DIR ~/$STAGING_DIR
        git -C ~/$STAGING_DIR remote set-url origin \"\$(git -C ~/$PROD_DIR remote get-url origin)\"
      fi
      cd ~/$STAGING_DIR/deploy
      if [ ! -f .env.staging ]; then
        umask 077
        key=\$(grep '^OPENAI_API_KEY=' ~/$PROD_DIR/deploy/.env | cut -d= -f2-)
        admins=\$(grep '^ADMIN_EMAILS=' ~/$PROD_DIR/deploy/.env | cut -d= -f2- || true)
        [ -n \"\$admins\" ] || admins=\$(grep '^ALLOWED_EMAILS=' ~/$PROD_DIR/deploy/.env | cut -d= -f2- || true)
        {
          echo \"POSTGRES_PASSWORD=\$(openssl rand -hex 32)\"
          echo \"JWT_SECRET=\$(openssl rand -base64 48 | tr -d '\n')\"
          echo \"OPENAI_API_KEY=\$key\"
          echo \"ALLOWED_EMAILS=\${admins}\"
          echo \"ADMIN_EMAILS=\${admins}\"
          echo 'AI_PER_DAY=100'
        } > .env.staging
        echo 'made deploy/.env.staging (who may sign up: production ADMIN_EMAILS, else ALLOWED_EMAILS)'
      fi
      grep -q '^STAGING_DOMAIN=' ~/$PROD_DIR/deploy/.env || echo 'note: add STAGING_DOMAIN=staging.gatazee.com to production .env'"
    ;;

  staging)
    ref=$(git rev-parse "${2:-HEAD}")
    git fetch -q origin
    if ! git branch -r --contains "$ref" | grep -q 'origin/'; then
      echo "$ref isn't pushed yet - git push first." >&2; exit 1
    fi
    echo "staging <- $(git log -1 --format='%h %s' "$ref")"
    on_server "set -e
      cd ~/$STAGING_DIR && git fetch -q origin && git checkout -q --detach $ref
      cd deploy && docker compose -f compose.staging.yaml --env-file .env.staging up -d --build 2>&1 | tail -4"
    ;;

  production)
    ref=$(on_server "git -C ~/$STAGING_DIR rev-parse HEAD")
    git fetch -q origin
    echo "production <- $(git log -1 --format='%h %s' "$ref" 2>/dev/null || echo "$ref") (what staging runs)"
    if [ "${2:-}" != "--yes" ]; then
      read -r -p "Deploy it to production? [y/N] " ok
      [ "$ok" = y ] || [ "$ok" = Y ] || { echo "Not deployed."; exit 1; }
    fi
    git push -q origin "$ref:refs/heads/production" # refused unless a fast-forward
    on_server "set -e
      docker network inspect gatazee-edge >/dev/null 2>&1 || docker network create gatazee-edge >/dev/null
      cd ~/$PROD_DIR && git fetch -q origin
      git checkout -q -B production origin/production
      cd deploy && docker compose up -d --build api web 2>&1 | tail -4"
    ;;

  status)
    on_server "echo \"staging:    \$(git -C ~/$STAGING_DIR log -1 --format='%h %cs %s' 2>/dev/null || echo 'not set up')\"
      echo \"production: \$(git -C ~/$PROD_DIR log -1 --format='%h %cs %s')\""
    ;;

  *)
    sed -n '2,10p' "$0"; exit 1 ;;
esac
