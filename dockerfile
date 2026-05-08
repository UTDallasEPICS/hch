# Build container
FROM node:22-alpine AS builder
COPY . ./

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

RUN PNPM_SKIP_CHECK_ONLY_BUILT_DEPS=true pnpm i --no-frozen-lockfile
RUN pnpm prisma generate
RUN npx esbuild prisma/seed.ts --bundle --platform=node --format=esm --packages=external --outfile=prisma/seed.mjs
RUN pnpm run build

# Deployment container
FROM node:22-alpine AS deployment

# Copy stuff from build container to ensure we have prisma and everything it needs
COPY --from=builder /.output /
COPY --from=builder /package.json /
COPY --from=builder /pnpm-lock.yaml /
COPY --from=builder /prisma.config.ts /
COPY --from=builder /prisma /prisma
COPY --from=builder /server/utils /server/utils
COPY --from=builder /node_modules /node_modules
RUN npm i -g pnpm
COPY ./entrypoint.sh /entrypoint.sh

# Esnure we can actually run the entrypoint script
RUN chmod +x /entrypoint.sh
EXPOSE 3000
ENTRYPOINT ["/entrypoint.sh"]
CMD ["node", "./server/index.mjs"]
