FROM node:22-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

COPY index.js ./
COPY src/ ./src/

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/index.js ./index.js
COPY --from=builder /app/src/ ./src/

RUN addgroup -S mcpuser && adduser -S mcpuser -G mcpuser
USER mcpuser

ENTRYPOINT ["node", "index.js"]
