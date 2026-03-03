# RetirementHub

Retirement budget and planning for couples (P1 & P2): household, income, expenses, and later stages for tax-leveraged limits, savings tracking, and projections.

## Setup

### Prerequisites

- Docker and Docker Compose
- PostgreSQL database

### Database Setup

1. Create a PostgreSQL database named `retirementhub` (or set `DB_NAME` in `.env`).
2. Run the schema:

```bash
psql -U postgres -d retirementhub -f database/schema.sql
```

Or from the monorepo root:

```bash
psql -U postgres -d retirementhub -f retirementhub/database/schema.sql
```

If you have an **existing** database created before the `as_of` and `account_balance` changes, run the migration after schema:

```bash
psql -U postgres -d retirementhub -f retirementhub/database/migrations/002_as_of_and_account_balance.sql
```

### Environment Configuration

1. Create a `.env` file in the project root directory (same level as `docker-compose.yml`):

```bash
cp env.example .env
```

Then edit `.env` with your database connection details:

```env
DB_HOST=your_postgres_host_or_container_name
DB_PORT=5432
DB_NAME=retirementhub
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

- Frontend: http://localhost:8110
- Backend API: http://localhost:8100/api/health

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

Vite proxies `/api` to http://localhost:8100. Open http://localhost:3010.

## Stage 1 — Budget

- **Household:** P1/P2 display names, birth years, tax filing status  
- **Income:** Gross salary (P1 and optional P2), expected raise %, bonus, 401(k) % and match  
- **Accounts:** User-defined accounts (any number): savings, checking, HSA, IRA (traditional/Roth), 401(k) (traditional/Roth), taxable. Your names; balances and contributions in Stage 3.  
- **Expenses:** Categories with current monthly, retirement monthly, “in retirement” flag, optional actual annual; mortgage (payment + payoff date); budget summary with current/retirement annual and 25× targets  

## Later stages

- **Stage 2:** Tax-leveraged savings maximums (IRA, HSA, 401k limits)  
- **Stage 3:** Tracking and updating savings totals  
- **Stage 4:** Projections and charts  
