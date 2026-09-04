#!/bin/sh
set -eu

if [ -z "${APP_URL:-}" ]; then
  echo "APP_URL is not set" >&2
  exit 1
fi

if [ -z "${CRON_SECRET:-}" ]; then
  echo "CRON_SECRET is not set" >&2
  exit 1
fi

# Render fromService `host` is an internal name (e.g. signatureforge).
# fromService `hostport` is host:port on the private network.
# TLS terminates at Render's edge — private-network calls must use HTTP.
case "$APP_URL" in
  http://*|https://*)
    TARGET="$APP_URL"
    ;;
  *:*)
    TARGET="http://$APP_URL"
    ;;
  *.onrender.com|*.*)
    TARGET="https://$APP_URL"
    ;;
  *)
    TARGET="http://${APP_URL}${APP_PORT:+:$APP_PORT}"
    ;;
esac

echo "Calling ${TARGET}/api/cron/tick"
HTTP_CODE=$(curl -sS -o /tmp/cron-response.json -w "%{http_code}" \
  -X POST "${TARGET}/api/cron/tick" \
  -H "Authorization: Bearer ${CRON_SECRET}" \
  -H "Content-Type: application/json" \
  --max-time 120)

echo "HTTP ${HTTP_CODE}"
cat /tmp/cron-response.json 2>/dev/null || true
echo

if [ "$HTTP_CODE" -lt 200 ] || [ "$HTTP_CODE" -ge 300 ]; then
  echo "Cron tick failed" >&2
  exit 1
fi

echo "Cron tick complete"
