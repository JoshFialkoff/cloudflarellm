# Production image: build + run share WORKDIR so `.next` is always present.

FROM node:22-bookworm-slim AS base
WORKDIR /code

ENV NEXT_TELEMETRY_DISABLED=1

COPY package.json package-lock.json ./
COPY scripts/patch-react-dom-edge.js scripts/
RUN npm ci

COPY . .
RUN chmod +x docker-entrypoint.sh \
    && npm run build

ENV NODE_ENV=production
# Default the container to the same internal port Traefik targets in compose.yaml.
# Override PORT explicitly when running outside of the compose.yaml context.
ENV PORT=3003
# A mismatch between proxy → container port is a common cause of Cloudflare / Traefik routing failures.
EXPOSE 3003
ENTRYPOINT ["/code/docker-entrypoint.sh"]
CMD ["npm", "start"]
