FROM node:22-alpine AS deps
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

FROM node:22-alpine AS build
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
COPY --from=deps /app/node_modules ./node_modules
COPY package.json tsconfig.json ./
COPY src ./src
RUN pnpm build && pnpm prune --prod

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080
RUN addgroup -S nodejs && adduser -S mcp -G nodejs
COPY --from=build --chown=mcp:nodejs /app/node_modules ./node_modules
COPY --from=build --chown=mcp:nodejs /app/dist ./dist
COPY --from=build --chown=mcp:nodejs /app/package.json ./
USER mcp
EXPOSE 8080
CMD ["node", "dist/index.js"]
