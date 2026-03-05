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

If your database was created before Social Security estimate fields on household, run:

```bash
psql -U postgres -d retirementhub -f retirementhub/database/migrations/005_household_ss_estimates.sql
```

If your database was created before SS at-FRA or expense category type (P2 health until Medicare), run:

```bash
psql -U postgres -d retirementhub -f retirementhub/database/migrations/006_household_ss_at_fra.sql
psql -U postgres -d retirementhub -f retirementhub/database/migrations/007_expense_category_type_p2_health.sql
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

**DEBUG (testing):** To allow 0% portfolio growth and 0% expense/COLA on the Projections page, set `DEBUG=1` in the **retirementhub** `.env` (same file used by docker-compose). Then **rebuild** so the frontend gets it at build time: `docker-compose up -d --build`. The backend reads `DEBUG` at runtime; the frontend needs `VITE_DEBUG` baked in at build time (docker-compose passes `DEBUG` as build-arg `VITE_DEBUG`). After rebuilding, the Projections form shows “DEBUG: 0% allowed for testing” and accepts 0 for both rates.

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
- **Stage 4:** Projections and charts — **Implemented.** Use the **Projections** page: net worth over time (with 25× retirement target line), income vs expenses by year, and configurable horizon and growth rate. Retirement dates on Household are used so wage income stops and Social Security starts per party; if P2 has no income and no P2 SS estimate, a spousal benefit (50% of P1’s) is applied when P2 retires. Set P1/P2 estimated monthly SS on Household for accurate retirement income.
- **Retirement tax adjustments:** On **Expenses**, use the "Tax categories in retirement" card to set Federal, Medicare, and Social Security for retirement. Social Security (OASDI) is **0** in retirement (no tax on benefits). Medicare uses a suggested Part B premium from a table (by year). Federal can be estimated from taxable income using IRS-style brackets and standard deduction; optional estimator on the same card.
- **P2 health until Medicare:** When P1 retires and goes on Medicare but P2 is not yet 65, you may need to budget for P2’s health insurance. On **Expenses**, set a category’s “In projections” to **P2 health until Medicare** and enter the monthly amount in Retirement/mo. In Projections that amount is only included for years when P1 is on Medicare and P2 is under 65, and it gets the same COLA as other expenses. The migration adds a seed category “P2 health until Medicare” you can use or rename.
