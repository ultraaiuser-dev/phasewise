# Multi-stage Dockerfile for Phasewise Server
FROM node:20-alpine AS builder

WORKDIR /app

# Copy root and package manifests
COPY package.json package-lock.json* tsconfig.base.json ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/server/package.json ./packages/server/
COPY packages/client/package.json ./packages/client/

# Install dependencies
RUN npm ci

# Copy source code for shared and server
COPY packages/shared ./packages/shared
COPY packages/server ./packages/server

# Build shared and server
RUN npm run build -w packages/shared
RUN npm run build -w packages/server

# Production runner stage
FROM node:20-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3001

COPY package.json package-lock.json* ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/server/package.json ./packages/server/

RUN npm ci --omit=dev

COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/server/dist ./packages/server/dist

EXPOSE 3001

CMD ["node", "packages/server/dist/index.js"]
