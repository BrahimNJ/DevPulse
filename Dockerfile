# syntax=docker/dockerfile:1

# Production image of the DevPulse server (ADR 0007). Base images are pinned by digest
# so that a build is reproducible; Dependabot proposes digest updates.

# Build stage: development dependencies and Vite, to build the interface.
FROM node:24-slim@sha256:55fb5f5a527ea2c5c4a95f963e48ef90aa38c7b346054fdc8ee9957a2b55d205 AS build
WORKDIR /app
COPY package.json package-lock.json ./
# The only lifecycle script installs Git hooks, which an image does not need.
RUN npm ci --ignore-scripts
COPY tsconfig.json vite.config.ts ./
COPY src/web ./src/web
RUN npm run build

# Runtime stage: distroless Node.js has no shell and no package manager, which leaves
# little to exploit, and runs as a non-root user. The server imports only the Node.js
# standard library, so no node_modules is copied; Node.js runs the TypeScript sources.
FROM gcr.io/distroless/nodejs24-debian13:nonroot@sha256:78f07ef1b5ea71ad7c055df15d0dd8997f2d288f9158623c4d4ae3d765b7d50d
WORKDIR /app
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=8080
# Files stay owned by root and read-only for the non-root user running the server.
COPY package.json ./
COPY src/branches ./src/branches
COPY src/github ./src/github
COPY src/server ./src/server
COPY --from=build /app/dist/web ./dist/web
USER nonroot
EXPOSE 8080
# The image entrypoint is node; ALLOWED_HOSTS and GITHUB_TOKEN come from the platform.
CMD ["src/server/main.ts"]
