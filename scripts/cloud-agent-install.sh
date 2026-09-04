#!/usr/bin/env bash
# Cloud Agent install script for SignatureForge.
# Idempotent: refreshes Node dependencies, provisions a local Postgres,
# applies Prisma migrations, and seeds the Contoso demo tenant.
set -euo pipefail

cd "$(dirname "$0")/.."

PG_VERSION="16"
PG_USER="signatureforge"
PG_PASSWORD="signatureforge"
PG_DB="signatureforge"

echo "==> Installing Node dependencies"
npm ci

echo "==> Ensuring PostgreSQL ${PG_VERSION} is installed"
if ! command -v pg_ctlcluster >/dev/null 2>&1; then
  sudo apt-get update -qq
  sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -qq postgresql postgresql-contrib
fi

echo "==> Starting PostgreSQL cluster"
sudo pg_ctlcluster "${PG_VERSION}" main start 2>/dev/null || true
for _ in $(seq 1 30); do
  if sudo -u postgres pg_isready -q 2>/dev/null; then break; fi
  sleep 1
done

echo "==> Ensuring database role and database exist"
if ! sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='${PG_USER}'" | grep -q 1; then
  sudo -u postgres psql -c "CREATE ROLE ${PG_USER} LOGIN PASSWORD '${PG_PASSWORD}';"
fi
if ! sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='${PG_DB}'" | grep -q 1; then
  sudo -u postgres createdb -O "${PG_USER}" "${PG_DB}"
fi

if [ ! -f .env ]; then
  echo "==> Writing local .env (demo mode, no Azure credentials required)"
  SECRET="$(openssl rand -hex 32)"
  CRON="$(openssl rand -hex 32)"
  cat > .env <<EOF
DATABASE_URL="postgresql://${PG_USER}:${PG_PASSWORD}@localhost:5432/${PG_DB}"
DIRECT_URL="postgresql://${PG_USER}:${PG_PASSWORD}@localhost:5432/${PG_DB}"
NEXTAUTH_URL="http://localhost:43123"
NEXTAUTH_SECRET="${SECRET}"
AUTH_SECRET="${SECRET}"
AUTH_DEMO_MODE="true"
CRON_SECRET="${CRON}"
NODE_ENV="development"
NEXT_PUBLIC_APP_URL="http://localhost:43123"
EOF
fi

set -a
# shellcheck disable=SC1091
. ./.env
set +a

echo "==> Generating Prisma client"
npx prisma generate

echo "==> Applying database migrations"
npx prisma migrate deploy

echo "==> Seeding Contoso demo tenant"
npm run db:seed

echo "==> Install complete"
