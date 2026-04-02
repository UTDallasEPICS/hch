# Stage 1: Build
FROM node:22-slim AS builder

ENV NODE_OPTIONS="--max-old-space-size=4096"
ENV CI=true
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN apt-get update && apt-get install -y openssl python3 make g++ && rm -rf /var/lib/apt/lists/*
RUN corepack enable

WORKDIR /app

COPY pnpm-lock.yaml package.json ./

# PNPM 10 FIX: 
# 1. We tell pnpm to ignore the 'execution' security prompt during install.
# 2. We explicitly add tailwindcss so the Vite plugin can find it.
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile --ignore-scripts=false && \
    pnpm add -D tailwindcss

COPY . .

# Generate Prisma Client
RUN npx prisma generate

# Build the Nuxt/Nitro application
RUN pnpm run build

RUN rm -rf .output/server/node_modules

# ... Rest of your Stage 2 and Stage 3 remain the same
# Stage 2: Production Dependencies
FROM node:22-slim AS prod-deps
RUN apt-get update && apt-get install -y openssl python3 make g++ && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=builder /app/.output/server/package.json ./package.json
RUN npm install --omit=dev --legacy-peer-deps

# Stage 3: Final Production Image
FROM node:22-slim
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/.output ./.output
COPY --from=prod-deps /app/node_modules ./.output/server/node_modules
COPY --from=builder /app/prisma ./prisma
EXPOSE 3000
CMD ["node", ".output/server/index.mjs"]
