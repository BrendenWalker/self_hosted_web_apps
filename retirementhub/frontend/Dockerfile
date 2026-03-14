# Pin to version tag for reproducible builds (avoid floating tag drift)
FROM node:18.20.0-alpine3.19 AS build

ARG VERSION=dev
ARG VITE_DEBUG
ENV VITE_VERSION=$VERSION
ENV VITE_DEBUG=$VITE_DEBUG

WORKDIR /app

COPY retirementhub/frontend/package*.json ./
RUN npm install

COPY retirementhub/frontend/ .
RUN npm run build

# Pin to version tag for reproducible builds
FROM nginx:1.27.0-alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY retirementhub/frontend/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
