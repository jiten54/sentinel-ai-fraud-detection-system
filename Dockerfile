# Production Dockerfile
FROM node:18-slim AS builder

WORKDIR /app

# Install dependencies first (better caching)
COPY package*.json ./
RUN npm install

# Copy source and generate Prisma client
COPY . .
RUN npx prisma generate

# Build frontend assets
RUN npm run build

# --- Runtime Stage ---
FROM node:18-slim

WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/server.ts ./server.ts
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/src ./src
COPY --from=builder /app/tsconfig.json ./tsconfig.json

# BullMQ and Prisma runtime needs these
RUN npx prisma generate

EXPOSE 3000

ENV NODE_ENV=production
CMD ["npx", "tsx", "server.ts"]
