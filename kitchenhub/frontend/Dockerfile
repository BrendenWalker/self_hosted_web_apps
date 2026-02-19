FROM node:18-alpine AS build

# Version injected at build (e.g. from CI tag or pr-N); Vite inlines VITE_* at build time
ARG VERSION=dev
ENV VITE_VERSION=$VERSION

WORKDIR /app

# Copy package files
COPY kitchenhub/frontend/package*.json ./

# Install dependencies
RUN npm install

# Copy application files
COPY kitchenhub/frontend/ .

# Build application
RUN npm run build

# Production stage
FROM nginx:alpine

# Copy built files from build stage
COPY --from=build /app/dist /usr/share/nginx/html

# Copy nginx configuration
COPY kitchenhub/frontend/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
