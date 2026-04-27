#!/bin/sh

# Apply migrations and initialize migrations if it does not exist
pnpm prisma generate
pnpm prisma migrate deploy
node prisma/seed.mjs

# Run the CMD command from the dockerfile
exec "$@"
