# Pin digest to avoid unnecessary re-pulls and improve cache; matches node:18-alpine
FROM node:18-alpine@sha256:70649fe1a0d792c12299abc78e1bc691884f8a7b519a294c351caa0748531b7c

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
