# One image: the NestJS API also serves the built React app.
FROM node:22-alpine AS web
WORKDIR /app/web
COPY web/package.json web/package-lock.json ./
RUN npm ci
COPY web/ ./
# The web app shares a few pure modules with the API (booking rules, time zones, seed data).
COPY api/src /app/api/src
RUN npx vite build

FROM node:22-alpine AS api
WORKDIR /app/api
COPY api/package.json api/package-lock.json ./
RUN npm ci
COPY api/ ./
RUN npm run build && npm prune --omit=dev

FROM node:22-alpine
ENV NODE_ENV=production PORT=3000 WEB_DIST_DIR=/app/web
WORKDIR /app/api
COPY --from=api /app/api/node_modules ./node_modules
COPY --from=api /app/api/dist ./dist
COPY --from=api /app/api/drizzle ./drizzle
COPY --from=api /app/api/package.json ./
COPY --from=web /app/web/dist /app/web
USER node
EXPOSE 3000
CMD ["node", "dist/main.js"]
