# Self-Hosted Web Apps

A monorepo containing multiple self-hosted web applications, each following a consistent architecture pattern with Docker containerization.

## Overview

This repository contains several independent web applications, each with its own backend API, frontend interface, and database schema. All services are designed to run on a single Docker host with centralized routing and TLS termination.

## Services

- **KitchenHub** - Shopping list management with store layout organization
- **VehicleHub** - Vehicle maintenance and service log tracking
- More services coming soon...

## Architecture

Each service follows a consistent architecture:

- **Backend**: Node.js/Express REST API
- **Frontend**: React + Vite, served by nginx
- **Database**: PostgreSQL (shared instance)
- **Deployment**: Docker containers

### Port Allocation

To avoid conflicts, each service uses unique ports:

- **KitchenHub**: Backend `8080`, Frontend `8081`
- **VehicleHub**: Backend `8090`, Frontend `8091`
- Future services: Increment by 10 (8100/8110, 8120/8130, etc.)

## Deployment Infrastructure

This project is deployed on a local network with the following infrastructure:

### Infrastructure Components

1. **Ubuntu Docker Host**
   - Runs all application containers
   - Hosts PostgreSQL database
   - Manages Docker networks and volumes

2. **HAProxy**
   - Handles routing for all `*.yourdomain.com` domains
   - Performs TLS termination
   - Routes requests to appropriate backend/frontend containers based on subdomain

3. **DNS Server / Router with ACME Support**
   - **ACME**: Creates and manages wildcard Let's Encrypt TLS certificate for `*.yourdomain.com`
   - **Certificate Distribution**: Automatically copies the certificate to the HAProxy container
   - **DNS**: Handles DNS resolution for all hosted services
   - **Tailscale Integration**: Runs Tailscale client to support remote client routing

4. **Tailscale**
   - Provides secure remote access via VPN
   - **Split DNS Configuration**:
     - **Local clients**: Resolve service domains to local network addresses
     - **Remote clients**: Resolve service domains to Tailscale addresses
   - Enables seamless access from both local and remote locations

### Network Flow

```
Internet/Tailscale
    ↓
HAProxy (TLS termination, *.yourdomain.com routing)
    ↓
Docker Containers (Backend/Frontend services)
    ↓
PostgreSQL Database
```

### DNS Resolution

- **Local Network**: Services resolve to local IP addresses (e.g., `192.168.x.x`)
- **Tailscale Network**: Services resolve to Tailscale IP addresses (e.g., `100.x.x.x`)
- All services accessible via `{service}.yourdomain.com` subdomains

## Local Deployment

### Prerequisites

- Docker and Docker Compose installed on Ubuntu host
- PostgreSQL database (can be containerized or external)
- HAProxy configured for routing
- DNS server/router with ACME client configured for certificate management
- Tailscale configured with split DNS

### Service Setup

Each service has its own directory with:

- `docker-compose.yml` - Local development/deployment
- `portainer-stack.yml` - Production deployment via Portainer
- `env.example` - Environment variable template
- `README.md` - Service-specific documentation

### Deploying a Service

1. **Navigate to service directory**:
   ```bash
   cd kitchenhub
   ```

2. **Create environment file**:
   ```bash
   cp env.example .env
   ```
   Edit `.env` with your database connection details.

3. **Set up database schema**:
   ```bash
   psql -U postgres -d your_database -f database/schema.sql
   ```

4. **Start services**:
   ```bash
   docker-compose up -d --build
   ```

5. **Configure HAProxy**:
   Add routing rules for the service subdomain (e.g., `kitchenhub.yourdomain.com`) pointing to the appropriate container ports.

6. **Configure DNS**:
   Add DNS records in your DNS server for the service subdomain.

### Health Checks

All backend services implement a health check endpoint at `/api/health`:
- Returns `200` when ready
- Returns `503` when not ready
- Used by Docker health checks and HAProxy monitoring

## Project Structure

```
.
├── common/              # Shared code across services
│   ├── database/       # Database connection utilities
│   └── api/            # API client reference
├── kitchenhub/         # KitchenHub service
│   ├── backend/        # Node.js/Express API
│   ├── frontend/       # React + Vite application
│   ├── database/       # PostgreSQL schema
│   └── docker-compose.yml
├── vehiclehub/         # VehicleHub service
│   ├── backend/        # Node.js/Express API
│   ├── frontend/       # React + Vite application
│   ├── database/       # PostgreSQL schema
│   └── docker-compose.yml
└── README.md           # This file
```

## Development

See individual service README files for development setup instructions:
- [KitchenHub README](kitchenhub/README.md)
- [VehicleHub README](vehiclehub/README.md)

## Shared Code

The `common/` directory contains reusable code:
- `common/database/db-config.js` - PostgreSQL connection pool (used by backends)
- `common/api/api-client.js` - API client reference (frontends inline this)

Backends import from common using relative paths:
```javascript
const { createDbPool } = require('../../common/database/db-config');
```

## Security Notes

- All services run behind HAProxy with TLS termination
- TLS certificates managed automatically via ACME client (e.g., certbot, ACME on router/firewall)
- Remote access secured via Tailscale VPN
- Services communicate over internal Docker networks
- Database access restricted to backend containers

## License

[Add your license here]
