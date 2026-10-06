# The web image: the built React app, served by Caddy - which also gets the
# HTTPS certificate and forwards /api to the API (see Caddyfile).
FROM node:22-alpine AS build
WORKDIR /src
COPY shared/ shared/
COPY web/package.json web/package-lock.json web/
RUN cd web && npm ci
COPY web/ web/
RUN cd web && npm run build

FROM caddy:2-alpine
COPY deploy/Caddyfile /etc/caddy/Caddyfile
COPY --from=build /src/web/dist /srv
