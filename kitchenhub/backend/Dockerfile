FROM node:18-alpine

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
