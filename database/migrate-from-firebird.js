/**
 * Automated Migration Script: Firebird to PostgreSQL
 * 
 * This script connects to your Firebird database, exports all shopping list data,
 * and generates a PostgreSQL seed-data.sql file.
 * 
 * Prerequisites:
 *   npm install node-firebird
 * 
 * Usage:
 *   1. Update the firebirdConfig below with your database connection details
 *   2. Run: node migrate-from-firebird.js
 *   3. Review the generated seed-data.sql file
 *   4. Run: psql -U postgres -d hausfrau -f seed-data.sql
 */

const Firebird = require('node-firebird');
const fs = require('fs');
const path = require('path');

// ============================================
// CONFIGURATION - Update these values
// ============================================
const firebirdConfig = {
  host: 'poot',                    // Firebird server hostname or IP
  port: 3050,                      // Firebird port (default: 3050)
  database: '/home/firebird/hausfrau.fdb',  // Full path to .fdb file
  // For Windows, use: 'C:/path/to/hausfrau.fdb'
  // For local file: './hausfrau.fdb'
  user: 'SYSDBA',
  password: 'masterkey',
  lowercase_keys: false,
  role: null,
  pageSize: 4096,
  // Authentication plugin - try these if you get "No matching plugins" error:
  // For Firebird 3.0+: 'Srp' (default) or 'Legacy_UserManager'
  // For Firebird 2.5: omit this or use 'Legacy_UserManager'
  // Try uncommenting one of these if authentication fails:
  // authPlugin: 'Srp',              // Firebird 3.0+ default
  // authPlugin: 'Legacy_UserManager', // For older Firebird or if Srp fails
};

const outputFile = path.join(__dirname, 'seed-data.sql');

// ============================================
// HELPER FUNCTIONS
// ============================================

function escapeSQLString(value) {
  if (value === null || value === undefined) {
    return 'NULL';
  }
  if (typeof value === 'number') {
    return value.toString();
  }
  if (typeof value === 'boolean') {
    return value ? '1' : '0';
  }
  // Escape single quotes by doubling them
  return "'" + String(value).replace(/'/g, "''") + "'";
}

function formatDate(date) {
  if (!date) return 'NULL';
  if (date instanceof Date) {
    return `'${date.toISOString()}'`;
  }
  return escapeSQLString(date);
}

function generateInsertStatement(tableName, columns, rows) {
  if (!rows || rows.length === 0) {
    return `-- No data found in ${tableName}\n`;
  }

  let sql = `-- ============================================\n`;
  sql += `-- ${tableName.toUpperCase()}\n`;
  sql += `-- ============================================\n`;
  sql += `-- ${rows.length} row(s)\n\n`;

  // Generate INSERT statements in batches for better performance
  const batchSize = 100;
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const columnList = columns.map(c => `"${c}"`).join(', ');
    
    sql += `INSERT INTO ${tableName} (${columnList}) VALUES\n`;
    
    const values = batch.map((row, idx) => {
      const rowValues = columns.map(col => {
        const value = row[col.toUpperCase()] !== undefined ? row[col.toUpperCase()] : row[col];
        return escapeSQLString(value);
      });
      const comma = idx < batch.length - 1 ? ',' : '';
      return `  (${rowValues.join(', ')})${comma}`;
    }).join('\n');
    
    sql += values + '\n';
    
    // Add ON CONFLICT clause based on table
    if (tableName === 'department') {
      sql += `ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;\n\n`;
    } else if (tableName === 'store') {
      sql += `ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;\n\n`;
    } else if (tableName === 'storezones') {
      sql += `ON CONFLICT (storeid, zonesequence, departmentid) DO UPDATE SET zonename = EXCLUDED.zonename;\n\n`;
    } else if (tableName === 'items') {
      sql += `ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, department = EXCLUDED.department, qty = EXCLUDED.qty, changed = EXCLUDED.changed;\n\n`;
    } else if (tableName === 'shopping_list') {
      sql += `ON CONFLICT (name) DO UPDATE SET department_id = EXCLUDED.department_id, description = EXCLUDED.description, quantity = EXCLUDED.quantity, purchased = EXCLUDED.purchased, item_id = EXCLUDED.item_id;\n\n`;
    } else {
      sql += `;\n\n`;
    }
  }
  
  return sql;
}

// ============================================
// DATABASE QUERY FUNCTIONS
// ============================================

function queryDatabase(db, sql) {
  return new Promise((resolve, reject) => {
    db.query(sql, (err, result) => {
      if (err) {
        reject(err);
      } else {
        resolve(result);
      }
    });
  });
}

async function exportTable(db, tableName, sql, columns) {
  try {
    console.log(`Exporting ${tableName}...`);
    const rows = await queryDatabase(db, sql);
    console.log(`  Found ${rows.length} row(s)`);
    return generateInsertStatement(tableName, columns, rows);
  } catch (err) {
    console.error(`  Error exporting ${tableName}:`, err.message);
    return `-- Error exporting ${tableName}: ${err.message}\n\n`;
  }
}

// ============================================
// MAIN MIGRATION FUNCTION
// ============================================

async function migrateData() {
  console.log('Starting Firebird to PostgreSQL migration...');
  console.log(`Connecting to: ${firebirdConfig.host}:${firebirdConfig.port}${firebirdConfig.database}`);
  console.log('');

  return new Promise((resolve, reject) => {
    Firebird.attach(firebirdConfig, async (err, db) => {
      if (err) {
        console.error('Error connecting to Firebird database:');
        console.error(err.message);
        console.error('');
        console.error('Please check:');
        console.error('  1. Firebird server is running');
        console.error('  2. Database path is correct');
        console.error('  3. Username and password are correct');
        console.error('  4. Network connectivity (if remote)');
        console.error('  5. Authentication plugin matches server');
        console.error('');
        console.error('If you see "No matching plugins" error:');
        console.error('  - Try adding authPlugin: "Legacy_UserManager" to firebirdConfig');
        console.error('  - Or try authPlugin: "Srp" for Firebird 3.0+');
        console.error('  - See FIREBIRD_CONNECTION.md for more details');
        reject(err);
        return;
      }

      try {
        console.log('Connected successfully!\n');

        let output = '';
        output += '-- ============================================\n';
        output += '-- Seed data migrated from Firebird database\n';
        output += '-- Generated by migrate-from-firebird.js\n';
        output += `-- Generated on: ${new Date().toISOString()}\n`;
        output += '-- ============================================\n\n';
        output += 'BEGIN;\n\n';

        // Export departments
        output += await exportTable(
          db,
          'department',
          'SELECT ID, NAME FROM department ORDER BY ID',
          ['id', 'name']
        );

        // Export stores
        output += await exportTable(
          db,
          'store',
          'SELECT ID, NAME FROM store ORDER BY ID',
          ['id', 'name']
        );

        // Export storezones
        output += await exportTable(
          db,
          'storezones',
          'SELECT STOREID, ZONESEQUENCE, ZONENAME, DEPARTMENTID FROM storezones ORDER BY STOREID, ZONESEQUENCE',
          ['storeid', 'zonesequence', 'zonename', 'departmentid']
        );

        // Export items
        output += await exportTable(
          db,
          'items',
          'SELECT ID, NAME, DEPARTMENT, QTY, CHANGED FROM items ORDER BY ID',
          ['id', 'name', 'department', 'qty', 'changed']
        );

        // Export shopping_list
        output += await exportTable(
          db,
          'shopping_list',
          'SELECT NAME, DEPARTMENT_ID, DESCRIPTION, QUANTITY, PURCHASED, ITEM_ID FROM shopping_list ORDER BY NAME',
          ['name', 'department_id', 'description', 'quantity', 'purchased', 'item_id']
        );


        output += 'COMMIT;\n\n';
        output += '-- Reset sequences to match imported IDs\n';
        output += 'SELECT setval(\'department_id_seq\', COALESCE((SELECT MAX(id) FROM department), 1), true);\n';
        output += 'SELECT setval(\'store_id_seq\', COALESCE((SELECT MAX(id) FROM store), 1), true);\n';
        output += 'SELECT setval(\'items_id_seq\', COALESCE((SELECT MAX(id) FROM items), 1), true);\n';

        // Write to file
        fs.writeFileSync(outputFile, output, 'utf8');
        console.log('');
        console.log(`✓ Migration complete!`);
        console.log(`✓ Generated file: ${outputFile}`);
        console.log('');
        console.log('Next steps:');
        console.log('  1. Review the generated seed-data.sql file');
        console.log('  2. Run: psql -U postgres -d hausfrau -f database/seed-data.sql');

        db.detach();
        resolve();
      } catch (err) {
        db.detach();
        reject(err);
      }
    });
  });
}

// ============================================
// RUN MIGRATION
// ============================================

if (require.main === module) {
  migrateData()
    .then(() => {
      console.log('Migration completed successfully!');
      process.exit(0);
    })
    .catch((err) => {
      console.error('Migration failed:', err);
      process.exit(1);
    });
}

module.exports = { migrateData, firebirdConfig };
