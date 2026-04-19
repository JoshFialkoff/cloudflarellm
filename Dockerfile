# Production image: build + run share WORKDIR so `.next` is always present.
# In Easypanel, choose build type “Dockerfile” (or equivalent) and set START to npm start if needed.

FROM node:22-bookworm-slim AS base
WORKDIR /code

ENV NEXT_TELEMETRY_DISABLED=1

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN chmod +x docker-entrypoint.sh && npm run build

ENV NODE_ENV=production
ENV PORT=3003

EXPOSE 3003
ENTRYPOINT ["/code/docker-entrypoint.sh"]
CMD ["npm", "start"]
