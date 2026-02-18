FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY backend/package*.json ./

# Install dependencies
RUN npm install --production

# Copy application files
COPY backend/ .

# Expose port
EXPOSE 80

# Start server
CMD ["node", "server.js"]
