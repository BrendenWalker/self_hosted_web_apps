const express = require('express');
const cors = require('cors');
const { createDbPool, testConnection } = require('../../common/database/db-config');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 80;

// App readiness state
let isReady = false;

// Middleware
app.use(cors());
app.use(express.json());

// PostgreSQL connection pool
const pool = createDbPool({
  database: process.env.DB_NAME || 'hausfrau',
});

// Test database connection (non-blocking, doesn't affect readiness)
testConnection(pool);

// Virtual "All" store: id -1, not in DB, not editable, all departments in General zone
const ALL_STORE_ID = -1;
const ALL_STORE = { id: ALL_STORE_ID, name: 'All', modified: null };

function isAllStore(id) {
  const n = parseInt(id, 10);
  return n === ALL_STORE_ID;
}

// ==================== STORES ====================

// Get all stores (synthetic "All" first, then DB stores; exclude DB rows named "All" so only one All exists)
app.get('/api/stores', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM store ORDER BY name');
    const rows = (result.rows || []).filter((r) => r.name !== 'All');
    res.json([ALL_STORE, ...rows]);
  } catch (error) {
    console.error('Error fetching stores:', error);
    res.status(500).json({ error: 'Failed to fetch stores' });
  }
});

// Get single store
app.get('/api/stores/:id', async (req, res) => {
  try {
    if (isAllStore(req.params.id)) {
      return res.json(ALL_STORE);
    }
    const result = await pool.query('SELECT * FROM store WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Store not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching store:', error);
    res.status(500).json({ error: 'Failed to fetch store' });
  }
});

// Create store
app.post('/api/stores', async (req, res) => {
  try {
    const { name } = req.body;
    const result = await pool.query(
      'INSERT INTO store (name) VALUES ($1) RETURNING *',
      [name]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating store:', error);
    res.status(500).json({ error: 'Failed to create store' });
  }
});

// Update store
app.put('/api/stores/:id', async (req, res) => {
  if (isAllStore(req.params.id)) {
    return res.status(403).json({ error: 'The All store cannot be modified' });
  }
  try {
    const { name } = req.body;
    const result = await pool.query(
      'UPDATE store SET name = $1, modified = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
      [name, req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Store not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating store:', error);
    res.status(500).json({ error: 'Failed to update store' });
  }
});

// Delete store
app.delete('/api/stores/:id', async (req, res) => {
  if (isAllStore(req.params.id)) {
    return res.status(403).json({ error: 'The All store cannot be deleted' });
  }
  try {
    const result = await pool.query('DELETE FROM store WHERE id = $1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Store not found' });
    }
    res.json({ message: 'Store deleted successfully' });
  } catch (error) {
    console.error('Error deleting store:', error);
    res.status(500).json({ error: 'Failed to delete store' });
  }
});

// ==================== STORE ZONES ====================

// Get zones for a store (All store: synthetic single zone "General" with all departments)
app.get('/api/stores/:storeId/zones', async (req, res) => {
  try {
    if (isAllStore(req.params.storeId)) {
      const depts = await pool.query(
        'SELECT id as departmentid, name as department_name FROM common.department ORDER BY name'
      );
      const synthetic = depts.rows.map((d) => ({
        storeid: ALL_STORE_ID,
        zonesequence: 1,
        zonename: 'General',
        departmentid: d.departmentid,
        department_name: d.department_name,
      }));
      return res.json(synthetic);
    }
    const result = await pool.query(
      `SELECT sz.*, d.name as department_name 
       FROM storezones sz 
       JOIN common.department d ON sz.departmentid = d.id 
       WHERE sz.storeid = $1 
       ORDER BY sz.zonesequence, d.name`,
      [req.params.storeId]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching store zones:', error);
    res.status(500).json({ error: 'Failed to fetch store zones' });
  }
});

// Create/Update store zone
app.post('/api/stores/:storeId/zones', async (req, res) => {
  if (isAllStore(req.params.storeId)) {
    return res.status(403).json({ error: 'The All store cannot be modified' });
  }
  try {
    const storeId = parseInt(req.params.storeId, 10);
    if (Number.isNaN(storeId) || storeId < 1) {
      return res.status(400).json({ error: 'Invalid store id' });
    }
    const { zonesequence: rawSeq, zonename, departmentid: rawDeptId } = req.body;
    const zonesequence = typeof rawSeq === 'number' ? rawSeq : parseInt(rawSeq, 10);
    const departmentid = typeof rawDeptId === 'number' ? rawDeptId : parseInt(rawDeptId, 10);
    if (Number.isNaN(zonesequence) || zonesequence < 1) {
      return res.status(400).json({ error: 'Invalid zonesequence' });
    }
    if (Number.isNaN(departmentid) || departmentid < 1) {
      return res.status(400).json({ error: 'Invalid department id' });
    }
    const zonenameSafe = zonename != null && String(zonename).trim() !== '' ? String(zonename).trim() : 'General';
    const result = await pool.query(
      `INSERT INTO storezones (storeid, zonesequence, zonename, departmentid) 
       VALUES ($1, $2, $3, $4) 
       ON CONFLICT (storeid, zonesequence, departmentid) 
       DO UPDATE SET zonename = $3, modified = CURRENT_TIMESTAMP 
       RETURNING *`,
      [storeId, zonesequence, zonenameSafe, departmentid]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating store zone:', error);
    const code = error.code;
    const message = error.message || 'Failed to create store zone';
    if (code === '23503') {
      return res.status(400).json({ error: 'Store or department not found', detail: message });
    }
    if (code === '23505') {
      return res.status(409).json({ error: 'Department already assigned to this zone', detail: message });
    }
    res.status(500).json({ error: 'Failed to create store zone', detail: message });
  }
});

// Swap the order of two zone sequences for a store
app.post('/api/stores/:storeId/zones/swap', async (req, res) => {
  if (isAllStore(req.params.storeId)) {
    return res.status(403).json({ error: 'The All store cannot be modified' });
  }
  const client = await pool.connect();
  try {
    const { seqA, seqB } = req.body;

    if (seqA === undefined || seqB === undefined) {
      return res.status(400).json({ error: 'seqA and seqB are required' });
    }

    // Use a temporary sequence value that should not normally appear
    const tempSeq = -1;

    await client.query('BEGIN');

    // Move A to temporary
    await client.query(
      'UPDATE storezones SET zonesequence = $3, modified = CURRENT_TIMESTAMP WHERE storeid = $1 AND zonesequence = $2',
      [req.params.storeId, seqA, tempSeq]
    );

    // Move B to A
    await client.query(
      'UPDATE storezones SET zonesequence = $2, modified = CURRENT_TIMESTAMP WHERE storeid = $1 AND zonesequence = $3',
      [req.params.storeId, seqA, seqB]
    );

    // Move temporary (original A) to B
    await client.query(
      'UPDATE storezones SET zonesequence = $2, modified = CURRENT_TIMESTAMP WHERE storeid = $1 AND zonesequence = $3',
      [req.params.storeId, seqB, tempSeq]
    );

    await client.query('COMMIT');

    res.json({ message: 'Store zones reordered successfully' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error swapping store zone order:', error);
    res.status(500).json({ error: 'Failed to reorder store zones' });
  } finally {
    client.release();
  }
});

// Delete store zone
app.delete('/api/stores/:storeId/zones/:zoneSequence/:departmentId', async (req, res) => {
  if (isAllStore(req.params.storeId)) {
    return res.status(403).json({ error: 'The All store cannot be modified' });
  }
  try {
    const result = await pool.query(
      'DELETE FROM storezones WHERE storeid = $1 AND zonesequence = $2 AND departmentid = $3 RETURNING *',
      [req.params.storeId, req.params.zoneSequence, req.params.departmentId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Store zone not found' });
    }
    res.json({ message: 'Store zone deleted successfully' });
  } catch (error) {
    console.error('Error deleting store zone:', error);
    res.status(500).json({ error: 'Failed to delete store zone' });
  }
});

// ==================== DEPARTMENTS ====================

// Get all departments
app.get('/api/departments', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM common.department ORDER BY name');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching departments:', error);
    res.status(500).json({ error: 'Failed to fetch departments', message: error.message });
  }
});

// Create department
app.post('/api/departments', async (req, res) => {
  try {
    const { name } = req.body;
    const result = await pool.query(
      'INSERT INTO common.department (name) VALUES ($1) RETURNING *',
      [name]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating department:', error);
    res.status(500).json({ error: 'Failed to create department', message: error.message });
  }
});

// ==================== ITEMS ====================

// Get all items
app.get('/api/items', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT i.*, d.name as department_name 
       FROM items i 
       LEFT JOIN common.department d ON i.department = d.id 
       ORDER BY d.name, i.name`
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching items:', error);
    res.status(500).json({ error: 'Failed to fetch items', message: error.message });
  }
});

// Get single item
app.get('/api/items/:id', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT i.*, d.name as department_name 
       FROM items i 
       LEFT JOIN common.department d ON i.department = d.id 
       WHERE i.id = $1`,
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Item not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching item:', error);
    res.status(500).json({ error: 'Failed to fetch item' });
  }
});

// Create item
app.post('/api/items', async (req, res) => {
  let name;
  try {
    const rawName = req.body.name;
    name = typeof rawName === 'string' ? rawName.trim() : '';
    if (!name) {
      return res.status(400).json({ error: 'Validation failed', detail: 'Item name is required' });
    }
    const { department, qty } = req.body;
    // Case-insensitive duplicate check (DB may have "parsley" while user adds "Parsley")
    const existing = await pool.query(
      'SELECT id, name FROM items WHERE LOWER(name) = LOWER($1)',
      [name]
    );
    if (existing.rows.length > 0) {
      const existingName = existing.rows[0].name;
      return res.status(409).json({
        error: 'Failed to create item',
        detail: existingName !== name
          ? `An item with this name already exists (existing item: "${existingName}")`
          : 'An item with this name already exists'
      });
    }
    const result = await pool.query(
      'INSERT INTO items (name, department, qty) VALUES ($1, $2, $3) RETURNING *',
      [name, department || null, qty || 0]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating item:', error);
    if (error.code === '23505') {
      // Unique violation: look up conflicting row (case-insensitive) for a helpful message
      const attemptedName = typeof req.body?.name === 'string' ? req.body.name.trim() : (name || '');
      if (attemptedName) {
        try {
          const existing = await pool.query(
            'SELECT id, name FROM items WHERE LOWER(name) = LOWER($1)',
            [attemptedName]
          );
          if (existing.rows.length > 0) {
            const row = existing.rows[0];
            return res.status(409).json({
              error: 'Failed to create item',
              detail: `An item with this name already exists: "${row.name}" (ID: ${row.id}). Find it in the Items list below.`,
              existingItem: { id: row.id, name: row.name }
            });
          }
        } catch (lookupErr) {
          console.error('Lookup conflicting item:', lookupErr);
        }
      }
      // Constraint failed but we couldn't find the row (e.g. different DB/collation). Include PG details for debugging.
      console.error('23505 constraint:', error.constraint, 'detail:', error.detail);
      return res.status(409).json({
        error: 'Failed to create item',
        detail: `An item with this name already exists (constraint: ${error.constraint || 'unknown'}).`,
        existingItem: null
      });
    }
    res.status(500).json({
      error: 'Failed to create item',
      detail: error.message || 'Unknown error'
    });
  }
});

// Update item
app.put('/api/items/:id', async (req, res) => {
  let name;
  try {
    const rawName = req.body.name;
    name = typeof rawName === 'string' ? rawName.trim() : '';
    if (!name) {
      return res.status(400).json({ error: 'Validation failed', detail: 'Item name is required' });
    }
    const { department, qty } = req.body;
    const id = req.params.id;
    // Case-insensitive duplicate check, excluding current item
    const existing = await pool.query(
      'SELECT id, name FROM items WHERE LOWER(name) = LOWER($1) AND id != $2',
      [name, id]
    );
    if (existing.rows.length > 0) {
      const existingName = existing.rows[0].name;
      return res.status(409).json({
        error: 'Failed to update item',
        detail: existingName !== name
          ? `An item with this name already exists (existing item: "${existingName}")`
          : 'An item with this name already exists'
      });
    }
    const result = await pool.query(
      'UPDATE items SET name = $1, department = $2, qty = $3 WHERE id = $4 RETURNING *',
      [name, department || null, qty || 0, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Item not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating item:', error);
    if (error.code === '23505') {
      const attemptedName = typeof req.body?.name === 'string' ? req.body.name.trim() : (name || '');
      const id = req.params.id;
      if (attemptedName) {
        try {
          const existing = await pool.query(
            'SELECT id, name FROM items WHERE LOWER(name) = LOWER($1) AND id != $2',
            [attemptedName, id]
          );
          if (existing.rows.length > 0) {
            const row = existing.rows[0];
            return res.status(409).json({
              error: 'Failed to update item',
              detail: `An item with this name already exists: "${row.name}" (ID: ${row.id}). Find it in the Items list below.`,
              existingItem: { id: row.id, name: row.name }
            });
          }
        } catch (lookupErr) {
          console.error('Lookup conflicting item:', lookupErr);
        }
      }
      console.error('23505 constraint:', error.constraint, 'detail:', error.detail);
      return res.status(409).json({
        error: 'Failed to update item',
        detail: `An item with this name already exists (constraint: ${error.constraint || 'unknown'}).`,
        existingItem: null
      });
    }
    res.status(500).json({
      error: 'Failed to update item',
      detail: error.message || 'Unknown error'
    });
  }
});

// Delete item
app.delete('/api/items/:id', async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM items WHERE id = $1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Item not found' });
    }
    res.json({ message: 'Item deleted successfully' });
  } catch (error) {
    console.error('Error deleting item:', error);
    res.status(500).json({ error: 'Failed to delete item' });
  }
});

// ==================== SHOPPING LIST (items with qty > 0) ====================

// Get shopping list for a store (All store -1: all items in General zone, no storezones)
app.get('/api/shopping-list/:storeId', async (req, res) => {
  try {
    const { showPurchased } = req.query;
    // Shopping list = items where qty > 0; no separate "purchased" state (marking purchased sets qty to 0)
    if (isAllStore(req.params.storeId)) {
      const result = await pool.query(
        `SELECT i.name, i.name as description, i.qty::text as quantity, 0 as purchased,
                i.department as department_id, i.id as item_id,
                'General' as zone, 0 as zone_seq,
                d.name as department_name
         FROM items i
         LEFT JOIN common.department d ON i.department = d.id
         WHERE i.qty > 0
         ORDER BY i.name`
      );
      return res.json(result.rows);
    }
    const result = await pool.query(
      `SELECT i.name, i.name as description, i.qty::text as quantity, 0 as purchased,
              i.department as department_id, i.id as item_id,
              COALESCE(sz.zonename, 'Uncategorized') as zone,
              COALESCE(sz.zonesequence, 999) as zone_seq,
              d.name as department_name
       FROM items i
       LEFT JOIN storezones sz ON sz.departmentid = i.department AND sz.storeid = $1
       LEFT JOIN common.department d ON i.department = d.id
       WHERE i.qty > 0
       ORDER BY COALESCE(sz.zonesequence, 999), i.name`,
      [req.params.storeId]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching shopping list:', error);
    res.status(500).json({ error: 'Failed to fetch shopping list', message: error.message });
  }
});

// Get all shopping list items (for management page) — items with qty > 0
app.get('/api/shopping-list', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT i.id as item_id, i.name, i.name as item_name, i.name as description,
              i.department as department_id, i.qty::text as quantity, 0 as purchased,
              d.name as department_name
       FROM items i
       LEFT JOIN common.department d ON i.department = d.id
       WHERE i.qty > 0
       ORDER BY i.name`
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching shopping list:', error);
    res.status(500).json({ error: 'Failed to fetch shopping list', message: error.message });
  }
});

// Add item to shopping list (increment qty or set by item_id/name)
app.post('/api/shopping-list', async (req, res) => {
  try {
    const { name, quantity, department_id, item_id } = req.body;
    const addQty = parseFloat(quantity) || 1;
    let result;
    if (item_id) {
      result = await pool.query(
        `UPDATE items SET qty = COALESCE(qty, 0) + $1 WHERE id = $2 RETURNING *`,
        [addQty, item_id]
      );
    } else if (name) {
      result = await pool.query(
        `UPDATE items SET qty = COALESCE(qty, 0) + $1 WHERE name = $2 RETURNING *`,
        [addQty, name]
      );
    } else {
      return res.status(400).json({ error: 'name or item_id required' });
    }
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Item not found' });
    }
    const row = result.rows[0];
    res.status(201).json({
      name: row.name,
      description: row.name,
      quantity: String(row.qty),
      purchased: 0,
      department_id: row.department,
      item_id: row.id
    });
  } catch (error) {
    console.error('Error adding to shopping list:', error);
    res.status(500).json({ error: 'Failed to add to shopping list' });
  }
});

// Update shopping list item (set qty by item name)
app.put('/api/shopping-list/:name', async (req, res) => {
  try {
    const { quantity } = req.body;
    if (quantity === undefined) {
      return res.status(400).json({ error: 'No fields to update' });
    }
    const qty = parseFloat(quantity);
    const num = Number.isNaN(qty) ? 0 : Math.max(0, qty);
    const result = await pool.query(
      'UPDATE items SET qty = $1 WHERE name = $2 RETURNING *',
      [num, req.params.name]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Shopping list item not found' });
    }
    const row = result.rows[0];
    res.json({
      name: row.name,
      description: row.name,
      quantity: String(row.qty),
      purchased: 0,
      department_id: row.department,
      item_id: row.id
    });
  } catch (error) {
    console.error('Error updating shopping list:', error);
    res.status(500).json({ error: 'Failed to update shopping list' });
  }
});

// Mark item as purchased — set qty to 0 so it leaves the list; unpurchase sets qty to 1
app.patch('/api/shopping-list/:name/purchased', async (req, res) => {
  try {
    const { purchased } = req.body;
    const qty = purchased ? 0 : 1;
    const result = await pool.query(
      'UPDATE items SET qty = $1 WHERE name = $2 RETURNING *',
      [qty, req.params.name]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Shopping list item not found' });
    }
    const row = result.rows[0];
    res.json({
      name: row.name,
      quantity: String(row.qty),
      purchased: purchased ? 1 : 0,
      department_id: row.department,
      item_id: row.id
    });
  } catch (error) {
    console.error('Error updating purchased status:', error);
    res.status(500).json({ error: 'Failed to update purchased status' });
  }
});

// Remove item from shopping list (set qty to 0)
app.delete('/api/shopping-list/:name', async (req, res) => {
  try {
    const result = await pool.query(
      'UPDATE items SET qty = 0 WHERE name = $1 RETURNING *',
      [req.params.name]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Shopping list item not found' });
    }
    res.json({ message: 'Item removed from shopping list' });
  } catch (error) {
    console.error('Error removing from shopping list:', error);
    res.status(500).json({ error: 'Failed to remove from shopping list' });
  }
});

// ==================== RECIPE CATEGORIES ====================

app.get('/api/recipe-categories', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM recipe.recipe_category ORDER BY name');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching recipe categories:', error);
    res.status(500).json({ error: 'Failed to fetch recipe categories' });
  }
});

// ==================== INGREDIENT MEASUREMENTS ====================

app.get('/api/ingredient-measurements', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM recipe.ingredient_measurement ORDER BY name');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching ingredient measurements:', error);
    res.status(500).json({ error: 'Failed to fetch ingredient measurements' });
  }
});

// ==================== INGREDIENTS (recipe catalog) ====================

app.get('/api/ingredients', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT i.id, i.name, i.details, i.measurement_id, i.department_id, i.shopping_measure, i.shopping_measure_grams,
              d.name as department_name, m.name as measurement_name
       FROM recipe.ingredients i
       LEFT JOIN common.department d ON i.department_id = d.id
       LEFT JOIN recipe.ingredient_measurement m ON i.measurement_id = m.id
       ORDER BY i.name, i.details`
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching ingredients:', error);
    res.status(500).json({ error: 'Failed to fetch ingredients' });
  }
});

// ==================== RECIPES ====================

app.get('/api/recipes', async (req, res) => {
  try {
    const { category_id } = req.query;
    let query = `
      SELECT r.id, r.name, r.servings, r.instructions, r.created, r.modified,
             (SELECT string_agg(c.name, ', ' ORDER BY c.name)
              FROM recipe.recipe_category_members m
              JOIN recipe.recipe_category c ON c.id = m.category_id
              WHERE m.recipe_id = r.id) AS category_names
      FROM recipe.recipe r
    `;
    const params = [];
    if (category_id != null && category_id !== '') {
      params.push(category_id);
      query += ` WHERE EXISTS (SELECT 1 FROM recipe.recipe_category_members m WHERE m.recipe_id = r.id AND m.category_id = $${params.length})`;
    }
    query += ' ORDER BY r.name';
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching recipes:', error);
    res.status(500).json({ error: 'Failed to fetch recipes' });
  }
});

app.get('/api/recipes/:id', async (req, res) => {
  try {
    const recipeResult = await pool.query(
      `SELECT r.id, r.name, r.servings, r.instructions, r.created, r.modified
       FROM recipe.recipe r
       WHERE r.id = $1`,
      [req.params.id]
    );
    if (recipeResult.rows.length === 0) {
      return res.status(404).json({ error: 'Recipe not found' });
    }
    const recipe = recipeResult.rows[0];

    const catResult = await pool.query(
      `SELECT m.category_id as id, c.name
       FROM recipe.recipe_category_members m
       JOIN recipe.recipe_category c ON c.id = m.category_id
       WHERE m.recipe_id = $1 ORDER BY c.name`,
      [req.params.id]
    );
    recipe.category_ids = catResult.rows.map((row) => row.id);
    recipe.category_names = catResult.rows.map((row) => row.name).join(', ');

    const ingResult = await pool.query(
      `SELECT ri.ingredient_id, ri.qty, ri.measurement_id, ri.comment, ri.is_optional,
              i.name as ingredient_name, i.details as ingredient_details, i.shopping_measure,
              m.name as measurement_name
       FROM recipe.recipe_ingredients ri
       JOIN recipe.ingredients i ON ri.ingredient_id = i.id
       LEFT JOIN recipe.ingredient_measurement m ON ri.measurement_id = m.id
       WHERE ri.recipe_id = $1
       ORDER BY i.name`,
      [req.params.id]
    );
    recipe.ingredients = ingResult.rows;
    res.json(recipe);
  } catch (error) {
    console.error('Error fetching recipe:', error);
    res.status(500).json({ error: 'Failed to fetch recipe' });
  }
});

app.post('/api/recipes', async (req, res) => {
  try {
    const { name, servings, category_ids, instructions } = req.body;
    const categoryIds = Array.isArray(category_ids) ? category_ids : (category_ids != null ? [category_ids] : []);
    if (categoryIds.length === 0) {
      return res.status(400).json({ error: 'At least one category is required' });
    }
    const result = await pool.query(
      `INSERT INTO recipe.recipe (name, servings, instructions)
       VALUES ($1, $2, $3) RETURNING *`,
      [name, servings || 1, instructions || null]
    );
    const recipeId = result.rows[0].id;
    for (const cid of categoryIds) {
      await pool.query(
        'INSERT INTO recipe.recipe_category_members (recipe_id, category_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [recipeId, cid]
      );
    }
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating recipe:', error);
    if (error.code === '23503') {
      return res.status(400).json({ error: 'Invalid category_id' });
    }
    if (error.code === '23505') {
      return res.status(409).json({ error: 'Recipe name already exists' });
    }
    res.status(500).json({ error: 'Failed to create recipe' });
  }
});

app.put('/api/recipes/:id', async (req, res) => {
  try {
    const { name, servings, category_ids, instructions } = req.body;
    const result = await pool.query(
      `UPDATE recipe.recipe SET name = $1, servings = $2, instructions = $3, modified = CURRENT_TIMESTAMP
       WHERE id = $4 RETURNING *`,
      [name, servings, instructions || null, req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Recipe not found' });
    }
    const categoryIds = Array.isArray(category_ids) ? category_ids : (category_ids != null ? [category_ids] : []);
    if (categoryIds.length === 0) {
      return res.status(400).json({ error: 'At least one category is required' });
    }
    if (categoryIds.length > 0) {
      await pool.query('DELETE FROM recipe.recipe_category_members WHERE recipe_id = $1', [req.params.id]);
      for (const cid of categoryIds) {
        await pool.query(
          'INSERT INTO recipe.recipe_category_members (recipe_id, category_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [req.params.id, cid]
        );
      }
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating recipe:', error);
    if (error.code === '23505') {
      return res.status(409).json({ error: 'Recipe name already exists' });
    }
    res.status(500).json({ error: 'Failed to update recipe' });
  }
});

app.delete('/api/recipes/:id', async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM recipe.recipe WHERE id = $1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Recipe not found' });
    }
    res.json({ message: 'Recipe deleted successfully' });
  } catch (error) {
    console.error('Error deleting recipe:', error);
    res.status(500).json({ error: 'Failed to delete recipe' });
  }
});

// Recipe ingredients: add one
app.post('/api/recipes/:id/ingredients', async (req, res) => {
  try {
    const { ingredient_id, qty, measurement_id, comment, is_optional } = req.body;
    const result = await pool.query(
      `INSERT INTO recipe.recipe_ingredients (recipe_id, ingredient_id, qty, measurement_id, comment, is_optional)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (recipe_id, ingredient_id) DO UPDATE SET qty = $3, measurement_id = $4, comment = $5, is_optional = $6
       RETURNING recipe_id, ingredient_id, qty, measurement_id, comment, is_optional`,
      [req.params.id, ingredient_id, qty ?? null, measurement_id ?? null, comment ?? null, Boolean(is_optional)]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error adding recipe ingredient:', error);
    if (error.code === '23503') {
      return res.status(400).json({ error: 'Recipe or ingredient not found' });
    }
    res.status(500).json({ error: 'Failed to add recipe ingredient' });
  }
});

// Recipe ingredients: update one
app.put('/api/recipes/:id/ingredients/:ingredientId', async (req, res) => {
  try {
    const { qty, measurement_id, comment, is_optional } = req.body;
    const result = await pool.query(
      `UPDATE recipe.recipe_ingredients SET qty = $1, measurement_id = $2, comment = $3, is_optional = $4
       WHERE recipe_id = $5 AND ingredient_id = $6 RETURNING *`,
      [qty ?? null, measurement_id ?? null, comment ?? null, Boolean(is_optional), req.params.id, req.params.ingredientId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Recipe ingredient not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating recipe ingredient:', error);
    res.status(500).json({ error: 'Failed to update recipe ingredient' });
  }
});

// Recipe ingredients: remove one
app.delete('/api/recipes/:id/ingredients/:ingredientId', async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM recipe.recipe_ingredients WHERE recipe_id = $1 AND ingredient_id = $2 RETURNING *',
      [req.params.id, req.params.ingredientId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Recipe ingredient not found' });
    }
    res.json({ message: 'Recipe ingredient removed' });
  } catch (error) {
    console.error('Error removing recipe ingredient:', error);
    res.status(500).json({ error: 'Failed to remove recipe ingredient' });
  }
});

// Health check endpoint (does not hit database)
app.get('/api/health', (req, res) => {
  const payload = {
    status: isReady ? 'ready' : 'not ready',
    timestamp: new Date().toISOString(),
    version: process.env.VERSION || 'dev'
  };
  if (isReady) {
    res.status(200).json(payload);
  } else {
    res.status(503).json(payload);
  }
});

function startServer(portToUse = port) {
  return app.listen(portToUse, () => {
    console.log(`Server running on port ${portToUse}`);
    isReady = true;
  });
}

if (require.main === module) {
  startServer();
} else {
  module.exports = { app, startServer };
}
