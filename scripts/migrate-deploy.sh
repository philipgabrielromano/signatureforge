#!/bin/sh
set -e
cd /app

# Next.js standalone images do not put `prisma` on PATH, and Alpine
# `npx prisma` then fails with "prisma: not found". Invoke the CLI
# JavaScript entrypoint directly.
if [ ! -f node_modules/prisma/build/index.js ]; then
  echo "Prisma CLI is missing from the image (node_modules/prisma/build/index.js)." >&2
  exit 1
fi

exec node node_modules/prisma/build/index.js migrate deploy
