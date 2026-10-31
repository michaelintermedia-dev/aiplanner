# The web image: the built React app, served by Caddy - which also gets the
# HTTPS certificate and forwards /api to the API (see Caddyfile).
FROM node:22-alpine AS build
WORKDIR /src
COPY shared/ shared/
COPY web/package.json web/package-lock.json web/
RUN cd web && npm ci
COPY web/ web/
# "staging" puts a STAGING ribbon on the page (compose.staging.yaml).
ARG VITE_STAGE=
RUN cd web && VITE_STAGE=$VITE_STAGE npm run build

FROM caddy:2-alpine
COPY deploy/Caddyfile /etc/caddy/Caddyfile
COPY --from=build /src/web/dist /srv
# gatazee.com itself: home page, privacy policy, terms.
COPY deploy/site /site
