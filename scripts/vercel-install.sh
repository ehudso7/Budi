#!/bin/bash
# Vercel install script - runs during the install phase

set -e

# Install dependencies
pnpm install --no-frozen-lockfile --prod=false

# Build contracts (shared types)
pnpm --filter @budi/contracts run build

# Push database schema (skip if DATABASE_URL not set)
cd services/api
pnpm prisma db push --skip-generate || echo "Prisma db push skipped"
cd ../..

# Build API
pnpm --filter @budi/api run build
