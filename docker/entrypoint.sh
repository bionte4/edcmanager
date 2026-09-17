#!/bin/sh
# Do not use `set -e` — Prisma push/seed are optional; app must still start.

echo "[edcmanager] starting…"

if [ -n "${DATABASE_URL:-}" ] && [ -f node_modules/prisma/build/index.js ]; then
  echo "[edcmanager] Prisma db push (optional)…"
  if node node_modules/prisma/build/index.js db push --skip-generate --accept-data-loss; then
    echo "[edcmanager] schema synced"
    if [ -f prisma/seed.mjs ]; then
      echo "[edcmanager] seeding dummy data…"
      if node prisma/seed.mjs; then
        echo "[edcmanager] seed ok"
      else
        echo "[edcmanager] seed skipped (non-fatal)"
      fi
    fi
  else
    echo "[edcmanager] db push skipped — check DATABASE_URL / Prisma deps"
  fi
else
  echo "[edcmanager] skip Prisma (no DATABASE_URL or prisma package)"
fi

exec "$@"
