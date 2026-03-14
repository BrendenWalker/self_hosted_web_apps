# Pin digest to avoid unnecessary re-pulls and improve cache; matches node:18-alpine
FROM node:18-alpine@sha256:70649fe1a0d792c12299abc78e1bc691884f8a7b519a294c351caa0748531b7c AS build

# Version injected at build (e.g. from CI tag or pr-N); Vite inlines VITE_* at build time
ARG VERSION=dev
ENV VITE_VERSION=$VERSION

WORKDIR /app

# Copy package files
COPY vehiclehub/frontend/package*.json ./

# Install dependencies
RUN npm install

# Copy application files
COPY vehiclehub/frontend/ .

# Build application
RUN npm run build

# Production stage; pin digest to avoid unnecessary re-pulls and improve cache; matches nginx:alpine
FROM nginx:alpine@sha256:24ab515c9c7d31dd337d1646362033bcb4fc6b35adad8c92d216058c8da581e2

# Copy built files from build stage
COPY --from=build /app/dist /usr/share/nginx/html

# Copy nginx configuration
COPY vehiclehub/frontend/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
