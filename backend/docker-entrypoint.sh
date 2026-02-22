#!/bin/sh
set -e

echo "Generating Prisma Client..."
npx prisma generate

echo "Syncing database schema..."
npx prisma db push --accept-data-loss

if [ -n "${RUN_SEED}" ]; then
  echo "Running database seed..."
  npx tsx prisma/seed.ts
fi

echo "Starting application..."
exec node dist/src/main.js

