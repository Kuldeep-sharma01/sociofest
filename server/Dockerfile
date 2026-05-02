# server/Dockerfile
# Standalone — build context is server/ directory itself
# Usage: docker build -t sociofest-backend ./server

FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

FROM node:22-alpine AS runner
WORKDIR /app

RUN apk add --no-cache curl ffmpeg tini

# Copy production deps
COPY --from=deps /app/node_modules ./node_modules

# Copy application source
COPY package.json ./
COPY server.js ./
COPY config ./config
COPY controllers ./controllers
COPY middleware ./middleware
COPY models ./models
COPY routes ./routes
COPY utils ./utils
COPY cron ./cron
COPY scripts ./scripts
COPY seeder.js ./

# Create uploads directory (volume mount point)
RUN mkdir -p uploads && chown -R node:node uploads

ENV NODE_ENV=production
ENV PORT=5000
EXPOSE 5000

USER node

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:5000/health || exit 1

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "server.js"]
