# Build context is the repository root (see docker-compose.yml), so the
# static frontend files can be copied alongside the server sources.
FROM node:22-alpine

WORKDIR /app

COPY server/package.json server/package-lock.json ./
RUN npm ci --omit=dev

COPY server/src ./src
COPY index.html style.css app.js manifest.webmanifest sw.js ./public/
COPY icons ./public/icons

ENV NODE_ENV=production
ENV DB_PATH=/data/scouting.db
ENV PORT=8080

EXPOSE 8080
VOLUME ["/data"]

CMD ["node", "--experimental-sqlite", "src/server.js"]
