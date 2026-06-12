# ──────────────────────────────────────────────
# Stage 1: Build
# ──────────────────────────────────────────────
FROM node:22-alpine AS builder

# Install pnpm globally
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Copy dependency manifests first — this layer is cached
# unless package.json or pnpm-lock.yaml changes
COPY package.json pnpm-lock.yaml ./

# Install ALL dependencies (including devDependencies for build)
RUN pnpm install --frozen-lockfile

# Copy the rest of the source
COPY . .

# Build the NestJS project
RUN pnpm run build

# Prune devDependencies — keep only what production needs
RUN pnpm prune --prod


# ──────────────────────────────────────────────
# Stage 2: Production
# ──────────────────────────────────────────────
FROM node:22-alpine AS production

# Install pnpm (needed because we use pnpm as pkg manager)
RUN corepack enable && corepack prepare pnpm@latest --activate

# Security: run as non-root user
USER node

WORKDIR /app

# Node.js memory optimization — 512MB heap per replica
# 3 replicas × 512MB = 1.5GB (fits in 8GB server)
ENV NODE_OPTIONS="--max-old-space-size=512"

# Copy only the built output and production node_modules from builder
COPY --from=builder --chown=node:node /app/dist ./dist
COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/package.json ./

# Dokploy provides PORT env var automatically
EXPOSE 3000

# Start the app
CMD ["node", "dist/main.js"]
