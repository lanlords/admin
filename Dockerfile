FROM node:22-bookworm-slim AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build
RUN npm prune --omit=dev

FROM node:22-bookworm-slim

WORKDIR /app

ENV NODE_ENV=production \
    PORT=8080 \
    CONFIG_PATH=/app/config.yaml \
    TEMPLATES_DIR=/app/templates

COPY --from=build /app/package.json ./package.json
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/dist-server ./dist-server
COPY --from=build /app/templates ./templates
COPY --from=build /app/config.yaml ./config.yaml

EXPOSE 8080

# The admin process manages the host Docker daemon, so it deliberately runs as
# root. This is a LAN-only, controlled deployment.
CMD ["node", "dist-server/server/index.js"]
