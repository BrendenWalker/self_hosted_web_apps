# VehicleHub

A modern, dockerized web application for tracking and managing vehicle service intervals and maintenance history. Migrated from the original Firebird/Delphi system to PostgreSQL and React.

## Features

- **Vehicle Management**: Add and manage your vehicles
- **Service Types**: Define service types like oil changes, tire rotations, and inspections
- **Service Intervals**: Configure when services are due by months or miles for each vehicle
- **Service History**: Log services performed and automatically calculate next due dates
- **Upcoming Services**: View services that are due soon across all vehicles

## Architecture

- **Backend**: Node.js/Express REST API
- **Frontend**: React with Vite
- **Database**: PostgreSQL
- **Deployment**: Docker containers

## Setup

### Prerequisites

- Docker and Docker Compose
- PostgreSQL database (you mentioned you already have one)

### Database Setup

1. Connect to your PostgreSQL database
2. Run the schema migration:

```bash
psql -U postgres -d vehiclehub -f database/schema.sql
```

Or if using a different database name:

```bash
psql -U your_user -d your_database -f database/schema.sql
```

### Environment Configuration

1. **For Docker Compose**: Create a `.env` file in the project root directory (same level as `docker-compose.yml`):

```bash
cp env.example .env
```

Then edit `.env` with your database connection details:

```env
DB_HOST=your_postgres_host_or_container_name
DB_PORT=5432
DB_NAME=vehiclehub
DB_USER=postgres
DB_PASSWORD=your_password
```

2. **For local development** (running `npm run dev`): Also copy `.env` to the `backend` directory:

```bash
cp .env backend/.env
```

### Build and Run

```bash
docker-compose up -d --build
```

### Access the Application

- Frontend: http://localhost:8091
- Backend API: http://localhost:8090/api/health

## First Steps

1. **Create Service Types**: Go to the "Service Types" page and create service types like "Oil Change", "Tire Rotation", etc.
2. **Add Vehicles**: Go to the "Vehicles" page and add your vehicles
3. **Configure Service Intervals**: Click on a vehicle to configure when services are due (by months or miles)
4. **Log Services**: As you perform services, log them to automatically update next due dates

## Code Sharing

This project shares common code with KitchenHub in the `common/` folder:

- `common/database/db-config.js` - Shared database connection pool configuration
- `common/api/api-client.js` - Shared API client setup for frontend

## Development

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

## Deployment

See `DEPLOYMENT.md` for detailed deployment instructions using Portainer and GitHub Actions.
