# Self-Hosted Web Apps

A monorepo of self-hosted web applications. Each service follows a consistent pattern: Node.js/Express backend, React + Vite frontend, PostgreSQL, and Docker.

## Overview

Each app has its own API, UI, and database schema. They are intended to run on a Docker host with a reverse proxy and TLS in front (details are up to your environment).

## Services

- **KitchenHub** — Shopping lists with optional store layout ordering, recipes, and related data
- **VehicleHub** — Vehicle maintenance and service history
- **RetirementHub** — Retirement-oriented budgeting, savings limits, and projections
- **MailHub** — Multi-container mail stack (SMTP, filtering, IMAP/LMTP). Different layout than the other hubs

## Architecture (KitchenHub, VehicleHub, RetirementHub)

- **Backend**: Node.js/Express REST API  
- **Frontend**: React + Vite (often served by nginx in production)  
- **Database**: PostgreSQL  
- **Deployment**: Docker / Compose (see each service)

### Port allocation (local dev)

Default ports are spaced to avoid clashes:

- **KitchenHub**: backend `8080`, frontend `8081`
- **VehicleHub**: backend `8090`, frontend `8091`
- **RetirementHub**: backend `8100`, frontend `8110`
- Future services: continue the pattern (e.g. +10 per service)

## Deployment (high level)

Typical setup:

1. **Host** — Linux with Docker (or similar) and persistent volumes for databases and app data  
2. **Database** — PostgreSQL (container or external)  
3. **Edge** — A reverse proxy terminating TLS and routing hostnames to the right containers (Caddy, nginx, Traefik, HAProxy, etc.)  
4. **DNS / certificates** — Whatever you use for names and ACME (router, separate DNS, internal DNS, etc.)

Each service directory includes `docker-compose.yml`, optional `portainer-stack.yml`, `env.example`, and a `README.md` with concrete steps.

### Local deploy (sketch)

1. `cd <service>`  
2. `cp env.example .env` and set database (and other) variables  
3. Apply `database/schema.sql` (and migrations if upgrading) with `psql`  
4. `docker compose up -d --build`  
5. Point your proxy at the published ports and add DNS names as needed  

Backends expose `/api/health` for readiness checks.

## Project structure

```
.
├── common/              # Shared code
│   ├── database/
│   └── api/
├── kitchenhub/
├── vehiclehub/
├── retirementhub/
├── mailhub/
└── README.md
```

## Development

- [KitchenHub README](kitchenhub/README.md)  
- [VehicleHub README](vehiclehub/README.md)  
- [RetirementHub README](retirementhub/README.md)  
- [MailHub README](mailhub/README.md)

## Shared code

`common/database/db-config.js` — PostgreSQL pool  
`common/api/api-client.js` — API client reference for frontends  

Backends import from `common` via relative paths, for example:

```javascript
const { createDbPool } = require('../../common/database/db-config');
```

## Security notes

- Run services behind TLS at the edge; do not commit real `.env` files or secrets  
- Restrict database access to application containers on internal networks  
- For MailHub, keep credentials in env or mounted secrets, not in public docs  

## License

[Add your license here]
