# Build context is the repo root (Railway's dockerfilePath only changes
# which file is used, not the context — see railway.json), so every COPY
# below is relative to the repo root, not this file's own directory.
FROM node:20-alpine
WORKDIR /app
COPY server/package.json server/package-lock.json ./
RUN npm ci --omit=dev
COPY server/ ./
ENV NODE_ENV=production
CMD ["node", "src/index.js"]
