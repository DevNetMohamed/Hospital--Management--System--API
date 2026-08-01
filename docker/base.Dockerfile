FROM node:22-alpine

LABEL maintainer="Mohamed Adel"

RUN apk add --no-cache dumb-init

RUN corepack enable && \
    corepack prepare pnpm@11.18.0 --activate
    
RUN addgroup -S hospital && \
    adduser -S hospital -G hospital

WORKDIR /app

RUN chown hospital:hospital /app

USER hospital
