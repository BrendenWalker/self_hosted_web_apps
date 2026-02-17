# Quick Start Guide

## Initial Setup

### 1. Database Setup

First, create the database schema in your PostgreSQL database:

```bash
psql -U postgres -d hausfrau -f database/schema.sql
```

Or using Docker if your PostgreSQL is in a container:

```bash
docker exec -i your-postgres-container psql -U postgres -d hausfrau < database/schema.sql
```

### 2. Configure Environment

Create a `.env` file in the project root directory (same level as `docker-compose.yml`):

```bash
cp .env.example .env
```

Then edit `.env` with your database connection details:

```env
DB_HOST=your_postgres_host_or_container_name
DB_PORT=5432
DB_NAME=hausfrau
DB_USER=postgres
DB_PASSWORD=your_password
```

**Important**: 
- If your PostgreSQL is in a Docker container on the same network, use the container name as `DB_HOST`
- Docker Compose automatically reads this `.env` file
- For local development (running `npm run dev`), also copy it to `backend/.env`

### 3. Update Docker Compose

Edit `docker-compose.yml` and update the database connection environment variables to match your PostgreSQL setup. If you're using an external PostgreSQL (not in docker-compose), you may need to:

1. Remove the `depends_on: postgres` from the backend service
2. Update `DB_HOST` to point to your PostgreSQL host (could be `host.docker.internal` on Windows/Mac, or the actual IP/hostname)

### 4. Build and Run

```bash
docker-compose up -d --build
```

### 5. Access the Application

- Frontend: http://localhost:3001
- Backend API: http://localhost:8080/api/health

## First Steps

1. **Create a Store**: Go to the "Stores" page and create your first store
2. **Add Departments**: You'll need departments before configuring zones. You can add them via the API or directly in the database
3. **Configure Store Zones**: For each store, add zones that map departments to physical locations
4. **Add Items**: Use the "Manage List" page to add items to your shopping list
5. **Shop**: Use the "Shopping" page to view your list organized by store layout

## Development Mode

If you want to develop locally without Docker:

### Backend
```bash
cd backend
npm install
npm run dev
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

The frontend dev server will proxy API requests to the backend.

## Troubleshooting

### Database Connection Issues

- Check that your PostgreSQL is accessible from the Docker network
- Verify environment variables are set correctly
- Test connection: `docker exec kitchenhub-backend node -e "console.log(process.env.DB_HOST)"`

### CORS Issues

- The backend has CORS enabled for all origins in development
- For production, you may want to restrict CORS to your domain

### Items Not Showing in Shopping List

- Make sure you've selected a store
- Verify that store zones are configured for the departments of your items
- Items without departments or with departments not in store zones will appear under "Uncategorized"

## Production Deployment

For production behind HAProxy:

1. Both frontend and backend should serve on port 80
2. HAProxy should handle TLS termination
3. Configure HAProxy to route:
   - `/api/*` → backend container
   - `/*` → frontend container
4. Update frontend `vite.config.js` or build-time environment variable `VITE_API_URL` to point to your API endpoint
