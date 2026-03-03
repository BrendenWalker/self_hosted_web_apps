FROM node:18-alpine

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
