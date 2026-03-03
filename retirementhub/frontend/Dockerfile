FROM node:18-alpine AS build

ARG VERSION=dev
ENV VITE_VERSION=$VERSION

WORKDIR /app

COPY retirementhub/frontend/package*.json ./
RUN npm install

COPY retirementhub/frontend/ .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY retirementhub/frontend/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
