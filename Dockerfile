# Production image: build + run share WORKDIR so `.next` is always present.
# In Easypanel, choose build type “Dockerfile” (or equivalent) and set START to npm start if needed.

FROM node:22-bookworm-slim AS base
WORKDIR /code

ENV NEXT_TELEMETRY_DISABLED=1

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
# Easypanel deploy: chmod targets ./deploy.sh under WORKDIR; exec uses /deploy.sh — keep both in sync.
RUN chmod +x docker-entrypoint.sh deploy.sh \
    && cp deploy.sh /deploy.sh && chmod +x /deploy.sh \
    && npm run build

ENV NODE_ENV=production
# Default the container to the same internal port Traefik targets in compose.yaml.
# Easypanel or other runtimes can still override PORT explicitly if needed.
ENV PORT=3003
# A mismatch between proxy → container port is a common cause of Cloudflare / Traefik routing failures.
EXPOSE 3003
ENTRYPOINT ["/code/docker-entrypoint.sh"]
CMD ["npm", "start"]
