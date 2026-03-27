FROM node:20-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY backend/package.json backend/package-lock.json* ./
# Install dependencies from lockfile and then add pdf-lib for PDF export
RUN npm ci && npm install pdf-lib

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY backend/ .
# Repo-root cluster tree (used by prisma/seed.ts in Docker: /app/EFILE_CLUSTER_TREE.md)
COPY EFILE_CLUSTER_TREE.md ./EFILE_CLUSTER_TREE.md

# Generate Prisma Client
RUN npx prisma generate

# Build the application
RUN npm run build

# Production image, copy all the files and run nest
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nestjs

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts
COPY --from=builder /app/EFILE_CLUSTER_TREE.md ./EFILE_CLUSTER_TREE.md
COPY backend/docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

EXPOSE 3001

ENV PORT=3001

CMD ["./docker-entrypoint.sh"]
