FROM mohamedadel204/hospital-base:1.2 AS builder
ENV CI=true
USER root

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

RUN pnpm install 

COPY apps ./apps
COPY libs ./libs
COPY nest-cli.json ./
COPY tsconfig.json ./
COPY tsconfig.build.json ./

RUN pnpm run build:auth-service


# ==========================
# Runtime Stage
# ==========================
FROM mohamedadel204/hospital-base:1.2

USER root

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

RUN pnpm install --prod 

COPY --from=builder /app/dist ./dist

RUN chown -R hospital:hospital /app

USER hospital

EXPOSE 3001

ENTRYPOINT ["dumb-init","--"]

CMD ["node","dist/apps/auth-service/main.js"]