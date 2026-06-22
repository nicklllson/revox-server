# ---------- builder ----------
  FROM node:20.19.5-bookworm-slim AS builder
  WORKDIR /app
  
  RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
  RUN npm install -g pnpm
  
  COPY package.json pnpm-lock.yaml ./
  RUN pnpm install --frozen-lockfile
  
  COPY . .
  
  RUN pnpm prisma generate
  RUN pnpm build
  
  # ---------- runner ----------
  FROM node:20.19.5-bookworm-slim AS runner
  WORKDIR /app
  ENV NODE_ENV=production
  
  RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
  RUN npm install -g pnpm
  
  COPY --from=builder /app/node_modules ./node_modules
  COPY --from=builder /app/dist ./dist
  COPY --from=builder /app/prisma ./prisma
  COPY --from=builder /app/generated ./generated
  COPY --from=builder /app/package.json ./package.json
  COPY --from=builder /app/prisma.config.ts ./prisma.config.ts
  
  EXPOSE 4200
  
  CMD ["sh", "-c", "pnpm prisma migrate deploy && node dist/src/main"]