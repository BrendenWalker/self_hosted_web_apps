FROM node:18-alpine AS build

WORKDIR /app

# Copy package files
COPY vehiclehub/frontend/package*.json ./

# Install dependencies
RUN npm install

# Copy application files
COPY vehiclehub/frontend/ .

# Build application
RUN npm run build

# Production stage
FROM nginx:alpine

# Copy built files from build stage
COPY --from=build /app/dist /usr/share/nginx/html

# Copy nginx configuration
COPY vehiclehub/frontend/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
