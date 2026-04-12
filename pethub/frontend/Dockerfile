FROM node:18.20.0-alpine3.19 AS build

ARG VERSION=dev
ENV VITE_VERSION=$VERSION
ENV NODE_OPTIONS=--dns-result-order=ipv4first

WORKDIR /app

COPY pethub/frontend/package.json ./
RUN npm install --no-audit --no-fund

COPY pethub/frontend/ .
RUN npm run build

FROM nginx:1.27.0-alpine

COPY --from=build /app/dist /usr/share/nginx/html
COPY pethub/frontend/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
