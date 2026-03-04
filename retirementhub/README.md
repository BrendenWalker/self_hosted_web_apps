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

If your database was created before retirement dates or per-party 401(k) fields, also run:

```bash
psql -U postgres -d retirementhub -f retirementhub/database/migrations/003_household_retirement_dates.sql
psql -U postgres -d retirementhub -f retirementhub/database/migrations/004_income_p2_401k.sql
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

### Import (CSV from GnuCash-style reports)

You can upload **expense totals** and **account balances** via CSV from the **Import** page (nav → Import).

- **Expense totals:** Use data from *Prior Year Discretionary* or *Prior Year Expenses* reports. CSV format: `category_name`, `category_group`, `actual_annual`. Select the **As of date** in the Import form (e.g. end of year). To build the CSV from the HTML report: copy the **Subtotal Table** (category names and totals) into a spreadsheet, add a header row and a `category_group` column (discretionary, fixed, insurance, utilities, tax, personal), then save as CSV. Category names are matched to existing expense categories; group must match.
- **Account balances:** Use end-of-year balances from your accounts/savings report. CSV format: `account_name`, `balance`. Select the **As of date** in the Import form. If an account does not exist, it is created as a Savings account. Copy into a spreadsheet and save as CSV.

Sample CSV templates are shown on the Import page.

## Later stages

- **Stage 2:** Tax-leveraged savings maximums (IRA, HSA, 401k limits) — **Implemented.** Use the **Savings limits** page: limits are broken down by party (P1 / P2) with catch-up included when that person is 50+ (IRA, 401k) or 55+ (HSA) at end of each year. Income page has 401(k) contribution % and match % per party; planned 401(k) is shown per party on Savings limits.
- **Stage 3:** Tracking and updating savings totals — **Implemented.** On the **Accounts** page, use “View history” per account to see all balance snapshots and add, edit, or delete them.
- **Stage 4:** Projections and charts  
