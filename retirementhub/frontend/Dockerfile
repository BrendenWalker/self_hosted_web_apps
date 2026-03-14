# Pin digest to avoid unnecessary re-pulls and improve cache; matches node:18-alpine
FROM node:18-alpine@sha256:70649fe1a0d792c12299abc78e1bc691884f8a7b519a294c351caa0748531b7c AS build

ARG VERSION=dev
ARG VITE_DEBUG
ENV VITE_VERSION=$VERSION
ENV VITE_DEBUG=$VITE_DEBUG

WORKDIR /app

COPY retirementhub/frontend/package*.json ./
RUN npm install

COPY retirementhub/frontend/ .
RUN npm run build

# Pin digest to avoid unnecessary re-pulls and improve cache; matches nginx:alpine
FROM nginx:alpine@sha256:24ab515c9c7d31dd337d1646362033bcb4fc6b35adad8c92d216058c8da581e2
COPY --from=build /app/dist /usr/share/nginx/html
COPY retirementhub/frontend/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
