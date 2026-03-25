FROM node:24-slim AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY index.js ./
COPY src/ ./src/

FROM gcr.io/distroless/nodejs24-debian12:nonroot
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/index.js ./index.js
COPY --from=builder /app/src/ ./src/

ENTRYPOINT ["/nodejs/bin/node", "index.js"]
