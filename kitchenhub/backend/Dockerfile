# Pin digest to avoid unnecessary re-pulls and improve cache; matches node:18-alpine
FROM node:18-alpine@sha256:70649fe1a0d792c12299abc78e1bc691884f8a7b519a294c351caa0748531b7c

# Version injected at build (e.g. from CI tag or pr-N)
ARG VERSION=dev
ENV VERSION=$VERSION

WORKDIR /app

# Copy common folder first (shared code)
COPY common ./common

# Copy package files
COPY kitchenhub/backend/package*.json ./

# Install dependencies
RUN npm install --production

# Copy application files (preserving structure so ../../common works)
COPY kitchenhub/backend ./kitchenhub/backend

# Set working directory to backend for running server
WORKDIR /app/kitchenhub/backend

# Expose port
EXPOSE 80

# Start server
CMD ["node", "server.js"]
