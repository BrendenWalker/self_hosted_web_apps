# Pin to version tag for reproducible builds (avoid floating tag drift)
FROM node:20.19.4-alpine3.21

ARG VERSION=dev
ENV VERSION=$VERSION

WORKDIR /app

COPY common ./common
COPY retirementhub/backend/package*.json ./
RUN npm install --production

COPY retirementhub/backend ./retirementhub/backend
WORKDIR /app/retirementhub/backend

EXPOSE 80
CMD ["node", "server.js"]
