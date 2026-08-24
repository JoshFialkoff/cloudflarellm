# ── Build Stage ──
FROM node:22-alpine AS builder
WORKDIR /app

# Install dependencies first for layer caching
COPY package.json package-lock.json* ./
RUN npm ci --ignore-scripts --prefer-offline

# Copy source and build
COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build

# ── Production Stage ──
FROM node:22-alpine AS production
WORKDIR /app

# Security: run as non-root
RUN addgroup -g 1001 -S mcp && adduser -u 1001 -S mcp -G mcp

# Copy compiled code + deps (no devDependencies)
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules ./node_modules

# Ensure data directory exists (actual data mounted as volume at runtime)
RUN mkdir -p public/data

# Lock down permissions (data file mounted at runtime)
RUN chown -R mcp:mcp /app && chmod -R 500 /app && chmod 700 public/data

USER mcp

# Deny-by-default outbound (runtime via --network or docker-compose)
# Container has no shell for escape
ENV NODE_ENV=production
ENV FACILITY_DATA_PATH=/app/public/data/chart-facilities.json
EXPOSE 8082

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:8082/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"

# Fail closed on unhandled exceptions
ENV NODE_OPTIONS="--unhandled-rejections=strict --no-warnings"

ENTRYPOINT ["node", "dist/server.js"]
CMD ["--transport=http", "--port=8082"]
