FROM node:24-alpine AS builder
WORKDIR /build

# Copy manifests for layer caching
COPY package*.json ./
COPY targets/odoo-mcp/package*.json targets/odoo-mcp/
COPY packages/odoo-client/package*.json packages/odoo-client/
COPY packages/odoo-introspection/package*.json packages/odoo-introspection/

# Install all deps (including dev, needed for tsc)
RUN npm ci --ignore-scripts

# Copy source for affected packages only
COPY tsconfig.json ./
COPY packages/odoo-introspection/ packages/odoo-introspection/
COPY packages/odoo-client/ packages/odoo-client/
COPY targets/odoo-mcp/ targets/odoo-mcp/

# Build in dependency order: client first (introspection imports from it)
RUN npm run build --workspace=packages/odoo-client && \
    npm run build --workspace=packages/odoo-introspection && \
    npm run build --workspace=targets/odoo-mcp

FROM node:24-alpine

# dumb-init: PID 1 reaping + SIGTERM→SIGINT forwarding for graceful shutdown
RUN apk add --no-cache dumb-init

WORKDIR /app
ENV NODE_ENV=production

# Re-create workspace structure for npm ci --omit=dev
COPY package*.json ./
COPY targets/odoo-mcp/package*.json targets/odoo-mcp/
COPY packages/odoo-client/package*.json packages/odoo-client/
COPY packages/odoo-introspection/package*.json packages/odoo-introspection/

# Install production-only deps
# npm creates workspace symlinks: node_modules/@marcfargas/odoo-client → packages/odoo-client
RUN npm ci --omit=dev --ignore-scripts

# Copy compiled output from builder
# Node follows symlinks: packages/odoo-client → reads package.json → main: "dist/index.js"
COPY --from=builder /build/packages/odoo-introspection/dist packages/odoo-introspection/dist
COPY --from=builder /build/packages/odoo-client/dist packages/odoo-client/dist
COPY --from=builder /build/targets/odoo-mcp/dist targets/odoo-mcp/dist

# ── Environment variables ────────────────────────────────────────────────────
#
# HTTP mode (default):
#   ODOO_MCP_ALLOWED_URLS   Required. Comma-separated Odoo base URLs (SSRF guard).
#                           e.g. https://prod.example.com,https://staging.example.com
#   ODOO_MCP_PORT           Bind port. Default: 3100.
#   ODOO_MCP_HOST           Bind address. Default: 0.0.0.0 (all interfaces).
#                           Set to 127.0.0.1 to accept only loopback connections.
#   ODOO_MCP_TRUST_PROXY    Set to "1" when behind a trusted reverse proxy
#                           (enables X-Forwarded-For for client IP logging).
#   ODOO_MCP_BODY_LIMIT     Express request body size limit. Default: 1mb.
#   ODOO_MCP_POOL_IDLE_MS   Milliseconds before an idle credential entry is evicted.
#                           Default: 1800000 (30 min).
#   ODOO_MCP_POOL_MAX_SIZE  Maximum simultaneous credential entries in the pool.
#                           New connections beyond this cap receive HTTP 429.
#                           Default: 50.
#   ODOO_MCP_POLICY_FILE    Path to JSON policy file inside container.
#   ODOO_MCP_POLICY         Inline JSON policy string (alternative to file).
#   ODOO_MCP_AUDIT_LOG      Path to JSONL audit log file inside container.
#
# stdio mode (--transport stdio):
#   ODOO_URL, ODOO_DB, ODOO_USER, ODOO_PASSWORD
# ────────────────────────────────────────────────────────────────────────────

EXPOSE 3100

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "\
    const port = process.env.ODOO_MCP_PORT || 3100; \
    require('http').get('http://127.0.0.1:' + port + '/health', r => \
      process.exit(r.statusCode === 200 ? 0 : 1) \
    ).on('error', () => process.exit(1))"

# Non-root user (built into official node:alpine image)
USER node

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "targets/odoo-mcp/dist/index.js"]
