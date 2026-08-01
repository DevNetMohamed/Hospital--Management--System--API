FROM node:22-alpine

LABEL maintainer="Mohamed Adel"

RUN apk add --no-cache dumb-init

RUN corepack enable

RUN addgroup -S hospital && \
    adduser -S hospital -G hospital

WORKDIR /app

RUN chown hospital:hospital /app

USER hospital
