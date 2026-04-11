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
  database: process.env.DB_NAME || 'kitchenhub',
});

// Test database connection (non-blocking, doesn't affect readiness)
testConnection(pool);

function parseItemNumber(value) {
  if (value == null || value === '') return null;
  const n = typeof value === 'string' ? parseFloat(value) : Number(value);
  if (Number.isNaN(n)) return null;
  return n;
}
function parseItemInt(value) {
  if (value == null || value === '') return null;
  const n = typeof value === 'string' ? parseInt(value, 10) : Number(value);
  if (Number.isNaN(n)) return null;
  return n;
}

const PACK1_GRAMS_EPS = 1e-6;

/** When count per pack is 1, ingredient grams and shopping measure grams must match if either is set. */
function validateCountPerPackOneGramsRule(ingredient_unit_grams, count_per_pack, shopping_measure_grams) {
  const cpp = parseItemInt(count_per_pack);
  if (cpp !== 1) return null;
  const iug = parseItemNumber(ingredient_unit_grams);
  const smg = parseItemNumber(shopping_measure_grams);
  const hasI = iug != null && Number.isFinite(iug);
  const hasS = smg != null && Number.isFinite(smg);
  if (!hasI && !hasS) return null;
  if (!hasI || !hasS) {
    return 'When count per pack is 1, ingredient unit (grams) and grams in shopping measure must both be set to the same value.';
  }
  if (Math.abs(iug - smg) > PACK1_GRAMS_EPS) {
    return 'When count per pack is 1, ingredient unit (grams) and grams in shopping measure must match.';
  }
  return null;
}

function deriveShoppingMeasureGrams({ ingredient_unit_grams, count_per_pack, shopping_measure_grams }) {
  const iug = parseItemNumber(ingredient_unit_grams);
  const cpp = parseItemInt(count_per_pack);
  if (iug != null && cpp != null && iug > 0 && cpp > 0) {
    return Math.round(iug * cpp * 100) / 100;
  }
  const smg = parseItemNumber(shopping_measure_grams);
  return smg;
}

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
    const { name, ingredient } = req.body;
    if (typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'name is required' });
    }
    const result = await pool.query(
      'INSERT INTO common.department (name, ingredient) VALUES ($1, $2) RETURNING *',
      [name.trim(), ingredient === true]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating department:', error);
    if (error.code === '23505') {
      return res.status(409).json({ error: 'Department name already exists' });
    }
    res.status(500).json({ error: 'Failed to create department', message: error.message });
  }
});

// Update department (e.g. toggle ingredient flag for recipe picker)
app.patch('/api/departments/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id) || id < 1) {
      return res.status(400).json({ error: 'Invalid department id' });
    }
    const { name, ingredient } = req.body;
    if (name === undefined && ingredient === undefined) {
      return res.status(400).json({ error: 'No fields to update' });
    }
    const parts = [];
    const values = [];
    let n = 1;
    if (name !== undefined) {
      if (typeof name !== 'string' || !name.trim()) {
        return res.status(400).json({ error: 'Invalid name' });
      }
      parts.push(`name = $${n++}`);
      values.push(name.trim());
    }
    if (ingredient !== undefined) {
      if (typeof ingredient !== 'boolean') {
        return res.status(400).json({ error: 'ingredient must be boolean' });
      }
      parts.push(`ingredient = $${n++}`);
      values.push(ingredient);
    }
    values.push(id);
    const result = await pool.query(
      `UPDATE common.department SET ${parts.join(', ')} WHERE id = $${n} RETURNING *`,
      values
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Department not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating department:', error);
    if (error.code === '23505') {
      return res.status(409).json({ error: 'Department name already exists' });
    }
    res.status(500).json({ error: 'Failed to update department', message: error.message });
  }
});

// ==================== ITEMS ====================

// Get all items
app.get('/api/items', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT i.*, d.name as department_name, m.name as measurement_name
       FROM items i 
       LEFT JOIN common.department d ON i.department = d.id 
       LEFT JOIN common.measurements m ON i.kcal_measurement_id = m.id
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
      `SELECT i.*, d.name as department_name, m.name as measurement_name
       FROM items i 
       LEFT JOIN common.department d ON i.department = d.id 
       LEFT JOIN common.measurements m ON i.kcal_measurement_id = m.id
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
    const {
      department,
      qty,
      details,
      kcal,
      kcal_measurement_id,
      shopping_measure,
      ingredient_unit_grams,
      count_per_pack,
      shopping_measure_grams,
      kcal_qty,
    } = req.body;
    const departmentId =
      department != null && department !== '' ? parseInt(department, 10) : NaN;
    if (Number.isNaN(departmentId) || departmentId < 1) {
      return res.status(400).json({ error: 'Validation failed', detail: 'department is required' });
    }
    const packErrCreate = validateCountPerPackOneGramsRule(
      ingredient_unit_grams,
      count_per_pack,
      shopping_measure_grams
    );
    if (packErrCreate) {
      return res.status(400).json({ error: 'Validation failed', detail: packErrCreate });
    }
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
    const kcalVal = kcal != null && kcal !== '' ? parseInt(kcal, 10) : null;
    const kcalQtyVal =
      kcal_qty != null && kcal_qty !== '' ? parseFloat(kcal_qty) : null;
    const measureId =
      kcal_measurement_id != null && kcal_measurement_id !== ''
        ? parseInt(kcal_measurement_id, 10)
        : null;
    const detailsTrim = details != null && String(details).trim() !== '' ? String(details).trim() : null;
    const shopMeasureTrim =
      shopping_measure != null && String(shopping_measure).trim() !== ''
        ? String(shopping_measure).trim()
        : null;
    const derivedSmg = deriveShoppingMeasureGrams({
      ingredient_unit_grams,
      count_per_pack,
      shopping_measure_grams,
    });
    const shopGrams =
      derivedSmg != null && !Number.isNaN(derivedSmg) ? derivedSmg : null;
    const iugVal = parseItemNumber(ingredient_unit_grams);
    const cppVal = parseItemInt(count_per_pack);

    const result = await pool.query(
      `INSERT INTO items (
         name, department, qty, details, kcal, kcal_qty, kcal_measurement_id,
         shopping_measure, ingredient_unit_grams, count_per_pack, shopping_measure_grams
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
      [
        name,
        departmentId,
        qty != null && qty !== '' ? parseFloat(qty) : 0,
        detailsTrim,
        Number.isNaN(kcalVal) ? null : kcalVal,
        Number.isNaN(kcalQtyVal) ? null : kcalQtyVal,
        Number.isNaN(measureId) ? null : measureId,
        shopMeasureTrim,
        iugVal,
        cppVal,
        shopGrams,
      ]
    );
    res.status(201).json(result.rows[0]);
    } catch (error) {
    console.error('Error creating item:', error);
    if (error.code === '23503') {
      return res.status(400).json({ error: 'Validation failed', detail: 'Invalid department' });
    }
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
    const {
      department,
      details,
      kcal,
      kcal_measurement_id,
      shopping_measure,
      ingredient_unit_grams,
      count_per_pack,
      shopping_measure_grams,
      kcal_qty,
    } = req.body;
    const departmentId =
      department != null && department !== '' ? parseInt(department, 10) : NaN;
    if (Number.isNaN(departmentId) || departmentId < 1) {
      return res.status(400).json({ error: 'Validation failed', detail: 'department is required' });
    }
    const packErrUpdate = validateCountPerPackOneGramsRule(
      ingredient_unit_grams,
      count_per_pack,
      shopping_measure_grams
    );
    if (packErrUpdate) {
      return res.status(400).json({ error: 'Validation failed', detail: packErrUpdate });
    }
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
    const kcalVal = kcal != null && kcal !== '' ? parseInt(kcal, 10) : null;
    const kcalQtyVal =
      kcal_qty != null && kcal_qty !== '' ? parseFloat(kcal_qty) : null;
    const measureId =
      kcal_measurement_id != null && kcal_measurement_id !== ''
        ? parseInt(kcal_measurement_id, 10)
        : null;
    const detailsTrim = details != null && String(details).trim() !== '' ? String(details).trim() : null;
    const shopMeasureTrim =
      shopping_measure != null && String(shopping_measure).trim() !== ''
        ? String(shopping_measure).trim()
        : null;
    const derivedSmg = deriveShoppingMeasureGrams({
      ingredient_unit_grams,
      count_per_pack,
      shopping_measure_grams,
    });
    const shopGrams =
      derivedSmg != null && !Number.isNaN(derivedSmg) ? derivedSmg : null;
    const iugVal = parseItemNumber(ingredient_unit_grams);
    const cppVal = parseItemInt(count_per_pack);

    // Do not update qty here — shopping list quantity is managed separately.
    const result = await pool.query(
      `UPDATE items SET
         name = $1,
         department = $2,
         details = $3,
         kcal = $4,
         kcal_qty = $5,
         kcal_measurement_id = $6,
         shopping_measure = $7,
         ingredient_unit_grams = $8,
         count_per_pack = $9,
         shopping_measure_grams = $10
       WHERE id = $11 RETURNING *`,
      [
        name,
        departmentId,
        detailsTrim,
        Number.isNaN(kcalVal) ? null : kcalVal,
        Number.isNaN(kcalQtyVal) ? null : kcalQtyVal,
        Number.isNaN(measureId) ? null : measureId,
        shopMeasureTrim,
        iugVal,
        cppVal,
        shopGrams,
        id,
      ]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Item not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating item:', error);
    if (error.code === '23503') {
      return res.status(400).json({ error: 'Validation failed', detail: 'Invalid department' });
    }
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
// items.qty is stored in grams. When shopping_measure_grams is set, API consumers treat
// PUT/POST "quantity" as shopping units (× grams per unit); GET returns raw grams in quantity.

function shoppingListRowJson(row, extra = {}) {
  return {
    name: row.name,
    description: row.name,
    details: row.details,
    quantity: String(row.qty),
    purchased: 0,
    department_id: row.department,
    item_id: row.id,
    shopping_measure: row.shopping_measure,
    shopping_measure_grams: row.shopping_measure_grams,
    ...extra,
  };
}

/** Delta to add to items.qty (grams): quantity param is shopping units if smg set, else grams. */
async function resolveShoppingListAddDelta(pool, { item_id, name, quantity }) {
  const q = parseFloat(quantity);
  const parsed = Number.isNaN(q) ? 1 : q;
  const lookup = item_id
    ? await pool.query('SELECT shopping_measure_grams FROM items WHERE id = $1', [item_id])
    : await pool.query('SELECT shopping_measure_grams FROM items WHERE name = $1', [name]);
  if (lookup.rows.length === 0) return null;
  const smg = lookup.rows[0].shopping_measure_grams;
  const smgNum = smg != null ? parseFloat(smg) : NaN;
  if (!Number.isNaN(smgNum) && smgNum > 0) {
    return parsed * smgNum;
  }
  return parsed;
}

// Get shopping list for a store (All store -1: all items in General zone, no storezones)
app.get('/api/shopping-list/:storeId', async (req, res) => {
  try {
    const { showPurchased } = req.query;
    // Shopping list = items where qty > 0; no separate "purchased" state (marking purchased sets qty to 0)
    if (isAllStore(req.params.storeId)) {
      const result = await pool.query(
        `SELECT i.name, i.name as description, i.details, i.qty::text as quantity, 0 as purchased,
                i.department as department_id, i.id as item_id,
                i.shopping_measure, i.ingredient_unit_grams, i.count_per_pack, i.shopping_measure_grams,
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
      `SELECT i.name, i.name as description, i.details, i.qty::text as quantity, 0 as purchased,
              i.department as department_id, i.id as item_id,
              i.shopping_measure, i.ingredient_unit_grams, i.count_per_pack, i.shopping_measure_grams,
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
      `SELECT i.id as item_id, i.name, i.name as item_name, i.name as description, i.details,
              i.department as department_id, i.qty::text as quantity, 0 as purchased,
              i.shopping_measure, i.ingredient_unit_grams, i.count_per_pack, i.shopping_measure_grams,
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
    const addGrams = await resolveShoppingListAddDelta(pool, { item_id, name, quantity });
    if (addGrams == null) {
      return res.status(404).json({ error: 'Item not found' });
    }
    let result;
    if (item_id) {
      result = await pool.query(
        `UPDATE items SET qty = COALESCE(qty, 0) + $1 WHERE id = $2 RETURNING *`,
        [addGrams, item_id]
      );
    } else if (name) {
      result = await pool.query(
        `UPDATE items SET qty = COALESCE(qty, 0) + $1 WHERE name = $2 RETURNING *`,
        [addGrams, name]
      );
    } else {
      return res.status(400).json({ error: 'name or item_id required' });
    }
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Item not found' });
    }
    const row = result.rows[0];
    res.status(201).json(shoppingListRowJson(row));
  } catch (error) {
    console.error('Error adding to shopping list:', error);
    res.status(500).json({ error: 'Failed to add to shopping list' });
  }
});

// Update shopping list item (set qty by item name). "quantity" is shopping units if shopping_measure_grams > 0, else grams.
app.put('/api/shopping-list/:name', async (req, res) => {
  try {
    const { quantity } = req.body;
    if (quantity === undefined) {
      return res.status(400).json({ error: 'No fields to update' });
    }
    const q = parseFloat(quantity);
    const num = Number.isNaN(q) ? 0 : Math.max(0, q);
    const result = await pool.query(
      `UPDATE items SET qty = CASE
         WHEN shopping_measure_grams IS NOT NULL AND shopping_measure_grams > 0
           THEN $1::numeric * shopping_measure_grams
         ELSE $1::numeric
       END
       WHERE name = $2 RETURNING *`,
      [num, req.params.name]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Shopping list item not found' });
    }
    const row = result.rows[0];
    res.json(shoppingListRowJson(row));
  } catch (error) {
    console.error('Error updating shopping list:', error);
    res.status(500).json({ error: 'Failed to update shopping list' });
  }
});

// Mark item as purchased — set qty to 0 so it leaves the list; unpurchase sets one shopping unit (or 1 g)
app.patch('/api/shopping-list/:name/purchased', async (req, res) => {
  try {
    const { purchased } = req.body;
    const result = await pool.query(
      `UPDATE items SET qty = CASE
         WHEN $1::boolean THEN 0
         WHEN shopping_measure_grams IS NOT NULL AND shopping_measure_grams > 0 THEN shopping_measure_grams
         ELSE 1
       END
       WHERE name = $2 RETURNING *`,
      [Boolean(purchased), req.params.name]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Shopping list item not found' });
    }
    const row = result.rows[0];
    res.json({
      ...shoppingListRowJson(row),
      purchased: purchased ? 1 : 0,
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

// ==================== MEASUREMENTS ====================

async function handleGetMeasurements(req, res) {
  try {
    const result = await pool.query('SELECT * FROM common.measurements ORDER BY name');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching measurements:', error);
    res.status(500).json({ error: 'Failed to fetch measurements' });
  }
}

app.get('/api/measurements', handleGetMeasurements);
app.get('/api/ingredient-measurements', handleGetMeasurements);

// ==================== INGREDIENTS (recipe catalog) ====================

app.get('/api/ingredients', async (req, res) => {
  try {
    const forRecipe =
      req.query.for_recipe === '1' ||
      req.query.for_recipe === 'true' ||
      req.query.for_recipe === 'yes';
    const result = await pool.query(
      `SELECT i.id, i.name, i.details, i.kcal, i.kcal_qty, i.qty, i.kcal_measurement_id, i.department as department_id, i.shopping_measure, i.ingredient_unit_grams, i.count_per_pack, i.shopping_measure_grams,
              d.name as department_name, m.name as measurement_name
       FROM items i
       LEFT JOIN common.department d ON i.department = d.id
       LEFT JOIN common.measurements m ON i.kcal_measurement_id = m.id
       WHERE (NOT $1::boolean OR d.ingredient IS TRUE)
       ORDER BY i.name, i.details`,
      [forRecipe]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching ingredients:', error);
    res.status(500).json({ error: 'Failed to fetch ingredients' });
  }
});

app.get('/api/ingredients/:id', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT i.id, i.name, i.details, i.kcal, i.kcal_qty, i.qty, i.kcal_measurement_id, i.department as department_id, i.shopping_measure, i.ingredient_unit_grams, i.count_per_pack, i.shopping_measure_grams,
              d.name as department_name, m.name as measurement_name
       FROM items i
       LEFT JOIN common.department d ON i.department = d.id
       LEFT JOIN common.measurements m ON i.kcal_measurement_id = m.id
       WHERE i.id = $1`,
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Ingredient not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching ingredient:', error);
    res.status(500).json({ error: 'Failed to fetch ingredient' });
  }
});

app.post('/api/ingredients', async (req, res) => {
  try {
    const {
      name,
      details,
      kcal,
      kcal_qty,
      qty,
      kcal_measurement_id,
      department_id,
      shopping_measure,
      ingredient_unit_grams,
      count_per_pack,
      shopping_measure_grams,
    } = req.body;
    if (!name || !department_id) {
      return res.status(400).json({ error: 'name and department_id are required' });
    }
    const packErrIng = validateCountPerPackOneGramsRule(
      ingredient_unit_grams,
      count_per_pack,
      shopping_measure_grams
    );
    if (packErrIng) {
      return res.status(400).json({ error: 'Validation failed', detail: packErrIng });
    }
    const kcalQtyParsed =
      kcal_qty != null && kcal_qty !== '' ? parseFloat(kcal_qty) : null;
    const derivedSmgIng = deriveShoppingMeasureGrams({
      ingredient_unit_grams,
      count_per_pack,
      shopping_measure_grams,
    });
    const smgFinal =
      derivedSmgIng != null && !Number.isNaN(derivedSmgIng) ? derivedSmgIng : null;
    const iugIng = parseItemNumber(ingredient_unit_grams);
    const cppIng = parseItemInt(count_per_pack);
    const result = await pool.query(
      `INSERT INTO items (name, details, kcal, kcal_qty, qty, kcal_measurement_id, department, shopping_measure, ingredient_unit_grams, count_per_pack, shopping_measure_grams)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING id, name, details, kcal, kcal_qty, qty, kcal_measurement_id, department as department_id, shopping_measure, ingredient_unit_grams, count_per_pack, shopping_measure_grams`,
      [
        name.trim(),
        details ? details.trim() : null,
        kcal != null ? parseInt(kcal, 10) : null,
        Number.isNaN(kcalQtyParsed) ? null : kcalQtyParsed,
        qty != null ? parseFloat(qty) : 0,
        kcal_measurement_id || null,
        department_id,
        shopping_measure ? shopping_measure.trim() : null,
        iugIng,
        cppIng,
        smgFinal,
      ]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating ingredient:', error);
    if (error.code === '23503') {
      return res.status(400).json({ error: 'Invalid department_id or kcal_measurement_id' });
    }
    if (error.code === '23505') {
      return res.status(409).json({ error: 'Ingredient with same name already exists' });
    }
    res.status(500).json({ error: 'Failed to create ingredient' });
  }
});

app.put('/api/ingredients/:id', async (req, res) => {
  try {
    const {
      name,
      details,
      kcal,
      kcal_qty,
      qty,
      kcal_measurement_id,
      department_id,
      shopping_measure,
      ingredient_unit_grams,
      count_per_pack,
      shopping_measure_grams,
    } = req.body;
    if (!name || !department_id) {
      return res.status(400).json({ error: 'name and department_id are required' });
    }
    const packErrPut = validateCountPerPackOneGramsRule(
      ingredient_unit_grams,
      count_per_pack,
      shopping_measure_grams
    );
    if (packErrPut) {
      return res.status(400).json({ error: 'Validation failed', detail: packErrPut });
    }
    const kcalQtyParsed =
      kcal_qty != null && kcal_qty !== '' ? parseFloat(kcal_qty) : null;
    const derivedSmgU = deriveShoppingMeasureGrams({
      ingredient_unit_grams,
      count_per_pack,
      shopping_measure_grams,
    });
    const smgFinalU =
      derivedSmgU != null && !Number.isNaN(derivedSmgU) ? derivedSmgU : null;
    const iugU = parseItemNumber(ingredient_unit_grams);
    const cppU = parseItemInt(count_per_pack);
    const result = await pool.query(
      `UPDATE items
       SET name = $1, details = $2, kcal = $3, kcal_qty = $4, qty = $5, kcal_measurement_id = $6, department = $7, shopping_measure = $8, ingredient_unit_grams = $9, count_per_pack = $10, shopping_measure_grams = $11
       WHERE id = $12
       RETURNING id, name, details, kcal, kcal_qty, qty, kcal_measurement_id, department as department_id, shopping_measure, ingredient_unit_grams, count_per_pack, shopping_measure_grams`,
      [
        name.trim(),
        details ? details.trim() : null,
        kcal != null ? parseInt(kcal, 10) : null,
        Number.isNaN(kcalQtyParsed) ? null : kcalQtyParsed,
        qty != null ? parseFloat(qty) : 0,
        kcal_measurement_id || null,
        department_id,
        shopping_measure ? shopping_measure.trim() : null,
        iugU,
        cppU,
        smgFinalU,
        req.params.id,
      ]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Ingredient not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating ingredient:', error);
    if (error.code === '23503') {
      return res.status(400).json({ error: 'Invalid department_id or kcal_measurement_id' });
    }
    if (error.code === '23505') {
      return res.status(409).json({ error: 'Ingredient with same name already exists' });
    }
    res.status(500).json({ error: 'Failed to update ingredient' });
  }
});

app.delete('/api/ingredients/:id', async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM items WHERE id = $1 RETURNING id', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Ingredient not found' });
    }
    res.json({ message: 'Ingredient deleted successfully' });
  } catch (error) {
    console.error('Error deleting ingredient:', error);
    if (error.code === '23503') {
      return res.status(400).json({ error: 'Cannot delete: ingredient is used in recipes' });
    }
    res.status(500).json({ error: 'Failed to delete ingredient' });
  }
});

// ==================== RECIPES ====================

app.get('/api/recipes', async (req, res) => {
  try {
    const { category_id, planned } = req.query;
    const plannedOnly =
      planned === '1' ||
      planned === 'true' ||
      String(planned).toLowerCase() === 'yes';
    let query = `
      SELECT r.id, r.name, r.servings, r.instructions, r.planned_at,
             (SELECT string_agg(c.name, ', ' ORDER BY c.name)
              FROM recipe.recipe_category_members m
              JOIN recipe.recipe_category c ON c.id = m.category_id
              WHERE m.recipe_id = r.id) AS category_names
      FROM recipe.recipe r
    `;
    const params = [];
    const where = [];
    if (category_id != null && category_id !== '') {
      params.push(category_id);
      where.push(
        `EXISTS (SELECT 1 FROM recipe.recipe_category_members m WHERE m.recipe_id = r.id AND m.category_id = $${params.length})`
      );
    }
    if (plannedOnly) {
      where.push('r.planned_at IS NOT NULL');
    }
    if (where.length > 0) {
      query += ` WHERE ${where.join(' AND ')}`;
    }
    query += plannedOnly ? ' ORDER BY r.planned_at ASC NULLS LAST, r.name' : ' ORDER BY r.name';
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
      `SELECT r.id, r.name, r.servings, r.instructions, r.planned_at
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
       JOIN items i ON ri.ingredient_id = i.id
       LEFT JOIN common.measurements m ON ri.measurement_id = m.id
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

app.patch('/api/recipes/:id/planned', async (req, res) => {
  try {
    const recipeId = parseInt(req.params.id, 10);
    if (Number.isNaN(recipeId) || recipeId < 1) {
      return res.status(400).json({ error: 'Invalid recipe id' });
    }
    const { planned } = req.body;
    if (planned !== true && planned !== false) {
      return res.status(400).json({ error: 'planned must be true or false' });
    }
    const result = await pool.query(
      `UPDATE recipe.recipe
       SET planned_at = CASE WHEN $1::boolean THEN now() ELSE NULL END
       WHERE id = $2
       RETURNING id, name, servings, instructions, planned_at`,
      [planned, recipeId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Recipe not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating recipe planned:', error);
    res.status(500).json({ error: 'Failed to update recipe planned state' });
  }
});

// Add recipe ingredients to shopping list: resolve grams per line (Each, Shopping Unit, or to_grams)
app.post('/api/recipes/:id/shopping-list', async (req, res) => {
  const recipeId = parseInt(req.params.id, 10);
  if (Number.isNaN(recipeId) || recipeId < 1) {
    return res.status(400).json({ error: 'Invalid recipe id' });
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const recipeCheck = await client.query('SELECT id FROM recipe.recipe WHERE id = $1', [recipeId]);
    if (recipeCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Recipe not found' });
    }
    const lines = await client.query(
      `SELECT ri.ingredient_id, ri.qty, ri.is_optional, ri.measurement_id,
              im.name AS measurement_name, im.to_grams,
              i.name AS ingredient_name,
              i.ingredient_unit_grams, i.shopping_measure_grams
       FROM recipe.recipe_ingredients ri
       LEFT JOIN common.measurements im ON ri.measurement_id = im.id
       JOIN items i ON ri.ingredient_id = i.id
       WHERE ri.recipe_id = $1`,
      [recipeId]
    );
    const added = [];
    const skipped = [];
    const skip = (row, reason, detail = {}) => {
      skipped.push({
        ingredient_id: row.ingredient_id,
        ingredient_name: row.ingredient_name,
        reason,
        ...detail,
      });
    };
    for (const row of lines.rows) {
      if (row.is_optional) {
        skip(row, 'optional');
        continue;
      }
      const qty = row.qty != null ? Number(row.qty) : 0;
      if (qty <= 0) {
        skip(row, 'no_qty', { qty: row.qty });
        continue;
      }
      if (!row.measurement_id) {
        skip(row, 'no_measurement', { measurement_id: row.measurement_id });
        continue;
      }
      const unitName = (row.measurement_name || '').trim().toLowerCase();
      let grams;
      if (unitName === 'each') {
        const g = row.ingredient_unit_grams != null ? Number(row.ingredient_unit_grams) : NaN;
        if (Number.isNaN(g) || g <= 0) {
          skip(row, 'no_ingredient_unit_grams', { ingredient_unit_grams: row.ingredient_unit_grams });
          continue;
        }
        grams = qty * g;
      } else if (unitName === 'shopping unit') {
        const g = row.shopping_measure_grams != null ? Number(row.shopping_measure_grams) : NaN;
        if (Number.isNaN(g) || g <= 0) {
          skip(row, 'no_shopping_measure_grams', { shopping_measure_grams: row.shopping_measure_grams });
          continue;
        }
        grams = qty * g;
      } else {
        const toGrams = row.to_grams != null ? Number(row.to_grams) : NaN;
        if (Number.isNaN(toGrams) || toGrams <= 0) {
          skip(row, 'no_to_grams', {
            measurement_name: row.measurement_name,
            to_grams: row.to_grams,
          });
          continue;
        }
        grams = qty * toGrams;
      }
      const upd = await client.query(
        `UPDATE items SET qty = COALESCE(qty, 0) + $1 WHERE id = $2 RETURNING id, name, qty`,
        [grams, row.ingredient_id]
      );
      if (upd.rows.length === 0) {
        skip(row, 'item_not_found');
        continue;
      }
      added.push({
        item_id: row.ingredient_id,
        name: upd.rows[0].name,
        grams_added: grams,
        qty_after: upd.rows[0].qty,
      });
    }
    await client.query(`UPDATE recipe.recipe SET planned_at = now() WHERE id = $1`, [recipeId]);
    await client.query('COMMIT');
    res.status(201).json({ added, skipped });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error adding recipe to shopping list:', error);
    res.status(500).json({ error: 'Failed to add recipe to shopping list', message: error.message });
  } finally {
    client.release();
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
      `UPDATE recipe.recipe SET name = $1, servings = $2, instructions = $3
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
