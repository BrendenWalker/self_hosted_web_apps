# KitchenHub

A modern, dockerized web application for managing shopping lists with store layout organization. Migrated from the original Firebird/Delphi system to PostgreSQL and React. Future plans include meal planning and adding recipe ingredients to the shopping list.

## Features

- **Shopping Page**: View shopping list organized by store layout/zones, mark items as purchased
- **Shopping List Management**: Add/remove items, manage quantities
- **Recipes**: Browse recipes by category, view ingredients (quantity, measurement, optional flag, comments), and see each ingredient’s shopping measure for future list building
- **Store Management**: Create stores and configure store zones (layout) for organizing shopping lists

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

1. Connect to your PostgreSQL database.
2. Run the schema (one file: common + main app + recipe):

```bash
# From repo root
psql -U postgres -d hausfrau -f kitchenhub/database/schema.sql
```

Use your DB name if different: `psql -U your_user -d your_database -f kitchenhub/database/schema.sql`

3. (Optional) Run migrations if upgrading an existing database:

   - **Remove legacy "All" store**: If you had a store named "All" in the database, you can remove it (the app now uses a synthetic "All" store with id -1). Run once:

   ```bash
   psql -U postgres -d hausfrau -f kitchenhub/database/migrations/001-remove-all-store.sql
   ```

   - **Recipe ingredient optional flag**: If your `recipe.recipe_ingredients` table has the old `option` column (SMALLINT, 1 = optional), run once to replace it with a native `is_optional` BOOLEAN (required for the Recipes feature):

   ```bash
   psql -U postgres -d hausfrau -f kitchenhub/database/migrations/002-recipe-ingredient-is-optional.sql
   ```

4. (Optional) Migrate data from Firebird database:

If you have an existing Firebird database, use the automated migration script:

```bash
cd database
npm install
# Edit migrate-from-firebird.js with your Firebird connection details
npm run migrate
# Review the generated seed-data.sql, then:
psql -U postgres -d hausfrau -f seed-data.sql
```

See `database/MIGRATION.md` for detailed migration instructions.

### Environment Configuration

1. **For Docker Compose**: Create a `.env` file in the project root directory (same level as `docker-compose.yml`):

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

2. **For local development** (running `npm run dev`): Also copy `.env` to the `backend` directory:

```bash
cp .env backend/.env
```

Docker Compose automatically reads the `.env` file from the root directory. The backend's `dotenv` package will read from `backend/.env` when running locally.

### Running with Docker Compose

1. Update `docker-compose.yml` with your database connection details
2. Build and start services:

```bash
docker-compose up -d --build
```

The application will be available at:
- Frontend: http://localhost:8081
- Backend API: http://localhost:8080

### Development Setup

#### Backend

```bash
cd backend
npm install
npm run dev
```

#### Frontend

```bash
cd frontend
npm install
npm run dev
```

### Testing

Backend and frontend both have automated tests (no database required for backend tests; DB is mocked).

```bash
# Backend (Jest + supertest)
cd backend
npm install
npm test

# Frontend (Vitest + React Testing Library)
cd frontend
npm install
npm test
```

**In CI (GitHub Actions):**

- **Test details** are reported back to GitHub: the workflow runs with coverage and JUnit output, then **Publish Test Results** shows pass/fail per test in the Actions run and on the Checks tab.
- **Coverage** is collected (backend: Jest; frontend: Vitest) and written to a **Code coverage** section in the job summary. Open a workflow run → **test** job → **Coverage summary** step to see tables for backend and frontend (lines, statements, functions, branches). Full coverage output is also in the **Run backend tests** / **Run frontend tests** step logs.

CI runs these tests on pull requests when `kitchenhub/**` changes.

## API Endpoints

### Stores
- `GET /api/stores` - Get all stores
- `GET /api/stores/:id` - Get single store
- `POST /api/stores` - Create store
- `PUT /api/stores/:id` - Update store
- `DELETE /api/stores/:id` - Delete store

### Store Zones
- `GET /api/stores/:storeId/zones` - Get zones for a store
- `POST /api/stores/:storeId/zones` - Create zone
- `DELETE /api/stores/:storeId/zones/:zoneSequence/:departmentId` - Delete zone

### Departments
- `GET /api/departments` - Get all departments
- `POST /api/departments` - Create department

### Items
- `GET /api/items` - Get all items
- `GET /api/items/:id` - Get single item
- `POST /api/items` - Create item
- `PUT /api/items/:id` - Update item
- `DELETE /api/items/:id` - Delete item

### Shopping List
- `GET /api/shopping-list` - Get all shopping list items
- `GET /api/shopping-list/:storeId` - Get shopping list for a store (ordered by layout)
- `POST /api/shopping-list` - Add item to shopping list
- `PUT /api/shopping-list/:name` - Update shopping list item
- `PATCH /api/shopping-list/:name/purchased` - Mark item as purchased/unpurchased
- `DELETE /api/shopping-list/:name` - Remove item from shopping list

### Recipes
- `GET /api/recipe-categories` - Get all recipe categories
- `GET /api/ingredient-measurements` - Get measurement units (tbsp, cup, etc.)
- `GET /api/ingredients` - Get ingredients catalog (includes shopping_measure for future list building)
- `GET /api/recipes` - Get all recipes (optional query: `?category_id=`)
- `GET /api/recipes/:id` - Get recipe with ingredients (each has quantity, measurement, comment, is_optional, shopping_measure)
- `POST /api/recipes` - Create recipe
- `PUT /api/recipes/:id` - Update recipe
- `DELETE /api/recipes/:id` - Delete recipe
- `POST /api/recipes/:id/ingredients` - Add ingredient to recipe
- `PUT /api/recipes/:id/ingredients/:ingredientId` - Update recipe ingredient
- `DELETE /api/recipes/:id/ingredients/:ingredientId` - Remove ingredient from recipe

## Usage

1. **Set up Stores**: Go to the Stores page and create stores
2. **Configure Store Layout**: For each store, add zones that map departments to physical locations in the store
3. **Add Items**: Use the Shopping List page to add items to your list
4. **Shop**: Use the Shopping page to view your list organized by store layout

## Notes

- The application is designed to run behind HAProxy with TLS termination
- Backend serves HTTP on port 80
- Frontend is a static React app served by nginx
- All API calls are proxied through the frontend nginx in production

## Future Enhancements

- **Add recipe ingredients to shopping list**: Use each ingredient’s `shopping_measure` (e.g. “quart container”) when adding required ingredients to the list
- **Meal Planning**: Plan meals and automatically generate shopping lists (mealplanner schema exists)
- User authentication and multi-user support
- Shopping history and analytics
- Mobile app (PWA)
- Price tracking
