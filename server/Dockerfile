FROM node:22-alpine AS deps
WORKDIR /app
COPY server/package*.json ./
RUN npm ci --omit=dev --platform=linux/amd64 --arch=x64

FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY server/ ./
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app

RUN apk add --no-cache curl ffmpeg tini

COPY --from=builder /app/dist ./dist
COPY server/package*.json ./
COPY server/server.js ./
COPY server/routes ./routes
COPY server/controllers ./controllers
COPY server/models ./models
COPY server/middleware ./middleware
COPY server/config ./config
COPY server/utils ./utils
COPY server/cron ./cron

RUN npm ci --omit=dev --only=production --platform=linux/amd64 --arch=x64 --no-optional && npm cache clean --force

ENV NODE_ENV=production
ENV PORT=5000
EXPOSE 5000

USER node

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:5000/health || exit 1

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "server.js"]
