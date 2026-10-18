# App image. CI builds it and pushes it to GHCR; the server only pulls it.
# One image runs the app (default command) and one-off jobs from deploy/compose.yaml:
# migrations before each deploy and test data on request.

FROM node:24.22-alpine AS base
ENV NEXT_TELEMETRY_DISABLED=1
WORKDIR /app

FROM base AS build
# pnpm version comes from packageManager in package.json
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
# Flat node_modules, like npm: the runtime stage copies whole packages out of it
RUN pnpm install --frozen-lockfile --config.node-linker=hoisted
COPY . .
RUN pnpm build

FROM base AS runtime
ENV NODE_ENV=production \
    HOSTNAME=0.0.0.0 \
    PORT=3000
# Server and the files it needs, traced by next build
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
# Packages the one-off jobs need beyond the server trace (drizzle-orm has no dependencies)
COPY --from=build /app/node_modules/drizzle-orm ./node_modules/drizzle-orm
COPY --from=build /app/node_modules/@next/env ./node_modules/@next/env
COPY drizzle ./drizzle
COPY scripts/migrate.mts scripts/seed.mts ./scripts/
COPY src/db/connection.ts src/db/schema.ts ./src/db/
USER node
EXPOSE 3000
CMD ["node", "server.js"]
