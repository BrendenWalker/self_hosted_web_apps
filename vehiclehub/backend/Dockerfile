FROM node:18-alpine

# Version injected at build (e.g. from CI tag or pr-N)
ARG VERSION=dev
ENV VERSION=$VERSION

WORKDIR /app

# Copy common folder first (shared code)
COPY common ./common

# Copy package files
COPY vehiclehub/backend/package*.json ./

# Install dependencies
RUN npm install --production

# Copy application files (preserving structure so ../../common works)
COPY vehiclehub/backend ./vehiclehub/backend

# Set working directory to backend for running server
WORKDIR /app/vehiclehub/backend

# Expose port
EXPOSE 80

# Start server
CMD ["node", "server.js"]
