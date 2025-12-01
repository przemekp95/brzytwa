# Dockerfile for backend-node
FROM node:18-alpine

WORKDIR /app

COPY backend-node/package*.json ./
RUN npm install

COPY backend-node/ .

EXPOSE 3001

CMD ["npx", "ts-node", "src/index.ts"]
