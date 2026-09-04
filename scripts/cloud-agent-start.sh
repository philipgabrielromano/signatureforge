#!/usr/bin/env bash
# Cloud Agent start script for SignatureForge.
# Reconciles the local Postgres daemon on every boot. Idempotent and
# safe to re-run: it starts the cluster only if it is not already up.
set -euo pipefail

PG_VERSION="16"

sudo pg_ctlcluster "${PG_VERSION}" main start 2>/dev/null || true
for _ in $(seq 1 30); do
  if sudo -u postgres pg_isready -q 2>/dev/null; then
    echo "PostgreSQL is ready"
    exit 0
  fi
  sleep 1
done

echo "PostgreSQL did not become ready in time" >&2
exit 1
