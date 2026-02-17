# KitchenHub Frontend

React frontend for the KitchenHub shopping list management application. Built with Vite and served via nginx.

## Features

- Shopping list management with store layout organization
- Store and zone configuration
- Responsive web interface
- API proxy configuration for backend communication

## Usage

```bash
docker run -d \
  -p 8081:80 \
  derpmhichurp/kitchenhub-frontend:latest
```

**Note**: The frontend expects the backend API to be accessible. Configure your reverse proxy or network accordingly.

## Environment

The frontend is a static React application served by nginx. No environment variables are required, but ensure the backend API is accessible at the configured endpoint.

## Source

Part of the KitchenHub monorepo.
