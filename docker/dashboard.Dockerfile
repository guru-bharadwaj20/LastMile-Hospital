# React dashboard: build with Node, serve the static output with nginx.
#
# Multi-stage so the published image carries no toolchain — the runtime layer
# is nginx plus a few hundred kilobytes of assets.
FROM node:22-alpine AS build

WORKDIR /app

# Copied first so a source-only change does not invalidate the install layer.
COPY lastmile/package.json lastmile/package-lock.json ./
RUN npm ci

COPY lastmile/ ./
RUN npm run build

FROM nginx:1.27-alpine AS runtime

COPY --from=build /app/dist /usr/share/nginx/html
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

HEALTHCHECK --interval=10s --timeout=3s --retries=3 \
    CMD wget -qO- http://127.0.0.1/ >/dev/null || exit 1
