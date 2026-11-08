# syntax=docker/dockerfile:1

# Floating major, so rebuilds pick up upstream OS and Node security patches
ARG NODE_VERSION=24

# Build stage
FROM node:${NODE_VERSION}-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# Production dependencies
FROM node:${NODE_VERSION}-slim AS prod-deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Runtime stage
FROM node:${NODE_VERSION}-slim AS runtime
WORKDIR /app

# Runtime only needs node, so drop the bundled package managers (and their CVEs)
RUN rm -rf /usr/local/lib/node_modules /opt/yarn-* \
      /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack \
      /usr/local/bin/yarn /usr/local/bin/yarnpkg

# Build metadata
ARG VERSION=dev
ARG REVISION=unknown
ARG CREATED=unknown
LABEL org.opencontainers.image.title="github-dashboards" \
      org.opencontainers.image.description="GitHub insights dashboard" \
      org.opencontainers.image.source="https://github.com/lissy93/github-dashboards" \
      org.opencontainers.image.licenses="MIT" \
      org.opencontainers.image.version="${VERSION}" \
      org.opencontainers.image.revision="${REVISION}" \
      org.opencontainers.image.created="${CREATED}"

ENV NODE_ENV=production \
    PORT=3000 \
    HOST=0.0.0.0

COPY --from=build /app/build ./build
COPY --from=build /app/package.json ./package.json
COPY --from=prod-deps /app/node_modules ./node_modules
COPY LICENSE ./LICENSE

EXPOSE 3000
USER node
CMD ["node", "build"]
