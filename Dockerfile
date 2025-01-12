FROM node:23-alpine AS base
FROM base AS build-env

WORKDIR /build
COPY ./package*json ./
RUN npm ci
COPY . .
RUN node --experimental-strip-types build.ts && \
    npm exec tsc && \
    npm ci --only=production --omit=dev

FROM base as deploy

WORKDIR /srv/abt

RUN apk add --no-cache docker-cli
COPY --from=build-env /build .

EXPOSE 8080
CMD [ "node", "--experimental-strip-types", "src/index.ts"]