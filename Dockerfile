  FROM node:20.19.5-bookworm-slim AS builder
  WORKDIR /app
  
  RUN corepack enable && corepack prepare pnpm@latest --activate
  
  COPY package.json pnpm-lock.yaml ./
  RUN pnpm install --frozen-lockfile
  
  COPY . .
  
  RUN pnpm prisma generate
  RUN pnpm build
  
  FROM node:20.19.5-bookworm-slim AS runner
  WORKDIR /app
  ENV NODE_ENV=production
  
  RUN corepack enable && corepack prepare pnpm@latest --activate
  
  COPY --from=builder /app/node_modules ./node_modules
  COPY --from=builder /app/dist ./dist
  COPY --from=builder /app/prisma ./prisma
  COPY --from=builder /app/package.json ./package.json
  
  EXPOSE 4200
  
  CMD ["sh", "-c", "pnpm prisma migrate deploy && node dist/main"]