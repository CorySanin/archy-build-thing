FROM node:23-alpine AS build-env

WORKDIR /build
COPY ./package*json ./
RUN npm ci --only=production --omit=dev

FROM docker:clie as deploy

WORKDIR /srv/abt

RUN apk add --no-cache nodejs
COPY --from=build-env /build .
COPY . .

EXPOSE 8080
CMD [ "node", "--experimental-strip-types", "index.ts"]