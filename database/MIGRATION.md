# Data Migration Guide: Firebird to PostgreSQL

This guide will help you migrate your existing data from the Firebird database to PostgreSQL.

## Option 1: Automated Script (Recommended)

The easiest way to migrate your data is using the automated migration script.

### Prerequisites

1. Install Node.js (if not already installed)
2. Install dependencies:
   ```bash
   cd database
   npm install
   ```

### Configuration

Edit `migrate-from-firebird.js` and update the `firebirdConfig` object:

```javascript
const firebirdConfig = {
  host: 'poot',                    // Your Firebird server hostname
  port: 3050,                      // Firebird port
  database: '/home/firebird/hausfrau.fdb',  // Path to your .fdb file
  // For Windows: 'C:/path/to/hausfrau.fdb'
  // For local file: './hausfrau.fdb'
  user: 'SYSDBA',
  password: 'masterkey',
  lowercase_keys: false,
  role: null,
  pageSize: 4096
};
```

### Run Migration

```bash
cd database
npm run migrate
```

Or directly:
```bash
node migrate-from-firebird.js
```

The script will:
1. Connect to your Firebird database
2. Export all tables (departments, stores, storezones, items, shopping_list, unit_type)
3. Generate a `seed-data.sql` file with PostgreSQL INSERT statements
4. Handle data type conversions and NULL values

### Import to PostgreSQL

After the script completes:

1. Review the generated `seed-data.sql` file
2. Make sure your PostgreSQL schema is created:
   ```bash
   psql -U postgres -d hausfrau -f schema.sql
   ```
3. Import the data:
   ```bash
   psql -U postgres -d hausfrau -f seed-data.sql
   ```

## Option 2: Manual Export/Import

### Step 1: Export Data from Firebird

Connect to your Firebird database using one of these tools:
- **isql** (command-line tool)
- **Flamerobin** (GUI tool)
- **Your existing Delphi application** (can query and export)

Run the queries from `export-firebird-queries.sql` to get your data.

### Step 2: Format the Data

For each table, format the exported data as INSERT statements. Examples:

**Departments:**
```sql
INSERT INTO department (id, name) VALUES
  (1, 'Produce'),
  (2, 'Dairy'),
  (3, 'Meat')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;
```

**Stores:**
```sql
INSERT INTO store (id, name) VALUES
  (1, 'Walmart'),
  (2, 'Kroger')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;
```

**Store Zones:**
```sql
INSERT INTO storezones (storeid, zonesequence, zonename, departmentid) VALUES
  (1, 1, 'Produce Section', 1),
  (1, 2, 'Dairy Section', 2)
ON CONFLICT (storeid, zonesequence, departmentid) 
DO UPDATE SET zonename = EXCLUDED.zonename;
```

**Items:**
```sql
INSERT INTO items (id, name, size, department, qty, changed) VALUES
  (1, 'Milk', NULL, 2, 0, 0),
  (2, 'Bread', NULL, 4, 0, 0)
ON CONFLICT (id) DO UPDATE SET 
  name = EXCLUDED.name, 
  size = EXCLUDED.size, 
  department = EXCLUDED.department, 
  qty = EXCLUDED.qty, 
  changed = EXCLUDED.changed;
```

**Shopping List:**
```sql
INSERT INTO shopping_list (name, department_id, description, quantity, purchased, item_id) VALUES
  ('Milk', 2, 'Whole Milk', '1', 0, 1),
  ('Bread', 4, 'White Bread', '1', 0, 2)
ON CONFLICT (name) DO UPDATE SET 
  department_id = EXCLUDED.department_id, 
  description = EXCLUDED.description, 
  quantity = EXCLUDED.quantity, 
  purchased = EXCLUDED.purchased, 
  item_id = EXCLUDED.item_id;
```

### Step 3: Import to PostgreSQL

1. First, run the schema:
   ```bash
   psql -U postgres -d hausfrau -f schema.sql
   ```

2. Then, add your formatted INSERT statements to `seed-data.sql` or create a new file

3. Run the seed data:
   ```bash
   psql -U postgres -d hausfrau -f seed-data.sql
   ```

## Option 2: Using isql to Export

If you have `isql` (Firebird command-line tool):

```bash
# Export departments
isql -user SYSDBA -password masterkey poot:/home/firebird/hausfrau.fdb -o departments.txt <<EOF
SET HEADING OFF;
SELECT 'INSERT INTO department (id, name) VALUES (' || ID || ', ''' || NAME || ''');' 
FROM department 
ORDER BY ID;
EOF

# Export stores
isql -user SYSDBA -password masterkey poot:/home/firebird/hausfrau.fdb -o stores.txt <<EOF
SET HEADING OFF;
SELECT 'INSERT INTO store (id, name) VALUES (' || ID || ', ''' || NAME || ''');' 
FROM store 
ORDER BY ID;
EOF

# Similar for other tables...
```

Then convert the output to PostgreSQL format (handle quotes, NULLs, etc.)

## Option 3: Using a Migration Tool

You can use tools like:
- **pgloader** - Can migrate directly from Firebird to PostgreSQL
- **DBeaver** - Has export/import functionality
- **Custom script** - Use the Node.js script template in `migrate-from-firebird.js`

### Using pgloader

```bash
# Install pgloader (if not already installed)
# On Ubuntu/Debian: sudo apt-get install pgloader
# On macOS: brew install pgloader

# Create a migration file (migrate.load)
pgloader <<EOF
LOAD DATABASE
  FROM firebird://sysdba:masterkey@poot:3050//home/firebird/hausfrau.fdb
  INTO postgresql://postgres:password@localhost/hausfrau
  WITH include drop, create tables, create indexes, reset sequences
  SET work_mem to '256MB', maintenance_work_mem to '512 MB'
  CAST type varchar to text drop typemod,
       type char to text drop typemod
  BEFORE LOAD DO
    \$\$ CREATE SCHEMA IF NOT EXISTS public; \$\$;
EOF
```

Note: You may need to adjust the schema after migration as Firebird and PostgreSQL have some differences.

## Important Notes

1. **Data Types**: Firebird uses different data types than PostgreSQL. Pay attention to:
   - `CHARACTER(80)` → `VARCHAR(80)` or `TEXT`
   - `INTEGER` → `INTEGER` or `SERIAL`
   - `REAL` → `REAL` or `DOUBLE PRECISION`

2. **Sequences**: After importing, reset sequences to match your imported IDs:
   ```sql
   SELECT setval('department_id_seq', (SELECT MAX(id) FROM department));
   SELECT setval('store_id_seq', (SELECT MAX(id) FROM store));
   SELECT setval('items_id_seq', (SELECT MAX(id) FROM items));
   ```

3. **Foreign Keys**: Make sure to import in the correct order:
   - Departments first
   - Stores second
   - Store zones (depends on stores and departments)
   - Items (depends on departments)
   - Shopping list (depends on departments and items)

4. **NULL Values**: Handle NULL values appropriately in your INSERT statements.

## Verification

After migration, verify your data:

```sql
-- Check record counts
SELECT 'departments' as table_name, COUNT(*) as count FROM department
UNION ALL
SELECT 'stores', COUNT(*) FROM store
UNION ALL
SELECT 'storezones', COUNT(*) FROM storezones
UNION ALL
SELECT 'items', COUNT(*) FROM items
UNION ALL
SELECT 'shopping_list', COUNT(*) FROM shopping_list;

-- Check for orphaned records
SELECT * FROM storezones WHERE storeid NOT IN (SELECT id FROM store);
SELECT * FROM storezones WHERE departmentid NOT IN (SELECT id FROM department);
SELECT * FROM items WHERE department NOT IN (SELECT id FROM department);
SELECT * FROM shopping_list WHERE department_id NOT IN (SELECT id FROM department);
```
