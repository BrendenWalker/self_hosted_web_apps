# KitchenHub Backend

Node.js/Express REST API backend for the KitchenHub shopping list management application.

## Features

- RESTful API for managing shopping lists, stores, departments, and items
- PostgreSQL database integration
- Store zone/layout management for organizing shopping lists
- Health check endpoint for monitoring

## Usage

```bash
docker run -d \
  -e DB_HOST=your-postgres-host \
  -e DB_PORT=5432 \
  -e DB_NAME=hausfrau \
  -e DB_USER=postgres \
  -e DB_PASSWORD=your-password \
  -p 8080:80 \
  derpmhichurp/kitchenhub-backend:latest
```

## Environment Variables

- `DB_HOST` - PostgreSQL host
- `DB_PORT` - PostgreSQL port (default: 5432)
- `DB_NAME` - Database name
- `DB_USER` - Database user
- `DB_PASSWORD` - Database password
- `PORT` - Server port (default: 80)

## API Endpoints

- `GET /api/health` - Health check
- `GET /api/stores` - List stores
- `GET /api/shopping-list` - Get shopping list
- See GitHub repository for full API documentation

## Source

Part of the KitchenHub monorepo.
