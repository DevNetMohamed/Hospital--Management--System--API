FROM mohamedadel204/hospital-base:1.2 AS builder

USER root

WORKDIR /app

# Dependencies
COPY package.json pnpm-lock.yaml ./

RUN pnpm install --frozen-lockfile

# Source Code
COPY apps ./apps
COPY libs ./libs
COPY nest-cli.json ./
COPY tsconfig.json ./
COPY tsconfig.build.json ./

# Build
RUN pnpm run build:api-gateway


# ==========================
# Runtime Stage
# ==========================
FROM mohamedadel204/hospital-base:1.2

USER root

WORKDIR /app

# Production dependencies only
COPY package.json pnpm-lock.yaml ./

RUN pnpm install --prod --frozen-lockfile

# Copy compiled application
COPY --from=builder /app/dist ./dist

RUN chown -R hospital:hospital /app

USER hospital

EXPOSE 3000

ENTRYPOINT ["dumb-init","--"]

CMD ["node","dist/apps/api-gateway/main.js"]