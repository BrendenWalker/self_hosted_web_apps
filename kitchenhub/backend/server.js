const express = require('express');
const cors = require('cors');
const { createDbPool, testConnection } = require('../../common/database/db-config');
const { recipeLineGrams, recipeLineGramsScaled, recipeLineKcal } = require('./recipeIngredientLine');
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

const RECIPE_SCALE_OPTIONS = new Set([0.5, 1, 2, 3, 4, 5]);

function normalizeRecipeScale(value) {
  if (value == null || value === '') return 1;
  const n = typeof value === 'string' ? parseFloat(value) : Number(value);
  if (!Number.isFinite(n) || !RECIPE_SCALE_OPTIONS.has(n)) return null;
  return n;
}

function parseDateOnly(value) {
  if (typeof value !== 'string') return null;
  const m = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (
    dt.getUTCFullYear() !== y ||
    dt.getUTCMonth() !== mo - 1 ||
    dt.getUTCDate() !== d
  ) return null;
  return dt;
}

function formatDateOnly(date) {
  return date.toISOString().slice(0, 10);
}

function startOfWeekMondayUtc(date = new Date()) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dow = d.getUTCDay();
  const offset = dow === 0 ? 6 : dow - 1;
  d.setUTCDate(d.getUTCDate() - offset);
  return d;
}

/** Local-calendar YYYY-MM-DD when client does not send `today` (aligns with meal planner week strings). */
function plannerTodayDefault() {
  const n = new Date();
  return formatDateOnly(new Date(Date.UTC(n.getFullYear(), n.getMonth(), n.getDate())));
}

/** First/last dates in the week strictly after `todayStr` (ISO); coversFullWeek if all seven days qualify. */
function computeEligibleFutureRangeInWeek(startDate, todayStr) {
  const weekStart = formatDateOnly(startDate);
  const endD = new Date(startDate);
  endD.setUTCDate(endD.getUTCDate() + 6);
  const weekEnd = formatDateOnly(endD);
  let eligibleStart = null;
  let eligibleEnd = null;
  for (let i = 0; i < 7; i += 1) {
    const d = new Date(startDate);
    d.setUTCDate(d.getUTCDate() + i);
    const ds = formatDateOnly(d);
    if (ds > todayStr) {
      if (!eligibleStart) eligibleStart = ds;
      eligibleEnd = ds;
    }
  }
  const coversFullWeek =
    Boolean(eligibleStart) && eligibleStart === weekStart && eligibleEnd === weekEnd;
  return { eligibleStart, eligibleEnd, coversFullWeek, weekStart, weekEnd };
}

async function fetchMealSlotColumnSet(db = pool) {
  const slotColsResult = await db.query(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_schema = 'mealplanner' AND table_name = 'meal_slot'`
  );
  return new Set((slotColsResult.rows || []).map((r) => r.column_name));
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

function measurementUnitGrams(measurementName, toGrams, ingredientUnitGrams, shoppingMeasureGrams) {
  const unitName = String(measurementName || '').trim().toLowerCase();
  if (unitName === 'each') return parseItemNumber(ingredientUnitGrams);
  if (unitName === 'shopping unit') return parseItemNumber(shoppingMeasureGrams);
  return parseItemNumber(toGrams);
}

function computeRecipeKcalPerServing(recipeRows) {
  const totalsByRecipe = new Map();
  for (const row of recipeRows) {
    const recipeId = Number(row.recipe_id);
    if (!Number.isInteger(recipeId)) continue;

    const qty = parseItemNumber(row.qty);
    const ingredientUnit = measurementUnitGrams(
      row.measurement_name,
      row.to_grams,
      row.ingredient_unit_grams,
      row.shopping_measure_grams
    );
    const kcal = parseItemNumber(row.kcal);
    const kcalQty = parseItemNumber(row.kcal_qty);
    const kcalUnit = measurementUnitGrams(
      row.kcal_measurement_name,
      row.kcal_to_grams,
      row.ingredient_unit_grams,
      row.shopping_measure_grams
    );
    const recipeServings = Math.max(1, parseItemInt(row.recipe_servings) || 1);

    const grams = qty != null && ingredientUnit != null && qty > 0 && ingredientUnit > 0
      ? qty * ingredientUnit
      : null;
    const basisGrams = kcalQty != null && kcalUnit != null && kcalQty > 0 && kcalUnit > 0
      ? kcalQty * kcalUnit
      : null;
    if (grams == null || basisGrams == null || kcal == null || kcal < 0) continue;

    const lineKcal = (grams / basisGrams) * kcal;
    if (!Number.isFinite(lineKcal) || lineKcal < 0) continue;

    const cur = totalsByRecipe.get(recipeId) || { total: 0, servings: recipeServings };
    cur.total += lineKcal;
    cur.servings = recipeServings;
    totalsByRecipe.set(recipeId, cur);
  }

  const perServingByRecipe = new Map();
  for (const [recipeId, value] of totalsByRecipe.entries()) {
    perServingByRecipe.set(recipeId, Math.max(0, Math.round(value.total / value.servings)));
  }
  return perServingByRecipe;
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
    if (error.code === '23503') {
      return res.status(400).json({ error: 'Cannot delete: item is used in one or more recipes' });
    }
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
              sz.zonename as zone,
              sz.zonesequence as zone_seq,
              d.name as department_name
       FROM items i
       INNER JOIN storezones sz ON sz.departmentid = i.department AND sz.storeid = $1
       LEFT JOIN common.department d ON i.department = d.id
       WHERE i.qty > 0
       ORDER BY sz.zonesequence, i.name`,
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
    const schedulableOnly =
      req.query.schedulable === '1' ||
      req.query.schedulable === 'true' ||
      String(req.query.schedulable).toLowerCase() === 'yes';
    const result = schedulableOnly
      ? await pool.query(
        'SELECT * FROM recipe.recipe_category WHERE schedulable IS TRUE ORDER BY name'
      )
      : await pool.query('SELECT * FROM recipe.recipe_category ORDER BY name');
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
       ORDER BY d.name, i.name, i.details`,
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
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
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

function parseRecipeCategoryFilterIds(query) {
  const raw = query.category_ids ?? query.category_id;
  if (raw == null || raw === '') return [];
  const parts = Array.isArray(raw) ? raw : [raw];
  const ids = parts
    .flatMap((value) => String(value).split(','))
    .map((value) => parseInt(String(value).trim(), 10))
    .filter((id) => Number.isInteger(id) && id > 0);
  return [...new Set(ids)];
}

app.get('/api/recipes', async (req, res) => {
  try {
    const { planned, schedulable } = req.query;
    const categoryIds = parseRecipeCategoryFilterIds(req.query);
    const plannedOnly =
      planned === '1' ||
      planned === 'true' ||
      String(planned).toLowerCase() === 'yes';
    const schedulableOnly =
      schedulable === '1' ||
      schedulable === 'true' ||
      String(schedulable).toLowerCase() === 'yes';
    let query = `
      SELECT r.id, r.name, r.servings, r.instructions,
             (
               SELECT MIN(m.meal_date)
               FROM mealplanner.meals m
               WHERE m.recipe_id = r.id
             ) AS planned_at,
             (SELECT string_agg(c.name, ', ' ORDER BY c.name)
              FROM recipe.recipe_category_members m
              JOIN recipe.recipe_category c ON c.id = m.category_id
              WHERE m.recipe_id = r.id) AS category_names
      FROM recipe.recipe r
    `;
    const params = [];
    const where = [];
    for (const categoryId of categoryIds) {
      params.push(categoryId);
      where.push(
        `EXISTS (
           SELECT 1
           FROM recipe.recipe_category_members m
           JOIN recipe.recipe_category c ON c.id = m.category_id
           WHERE m.recipe_id = r.id
             AND m.category_id = $${params.length}
             AND ($${params.length + 1}::boolean IS FALSE OR c.schedulable IS TRUE)
         )`
      );
      params.push(schedulableOnly);
    }
    if (schedulableOnly) {
      where.push('r.schedulable IS TRUE');
    }
    if (plannedOnly) {
      where.push('EXISTS (SELECT 1 FROM mealplanner.meals m WHERE m.recipe_id = r.id)');
    }
    if (where.length > 0) {
      query += ` WHERE ${where.join(' AND ')}`;
    }
    query += plannedOnly ? ' ORDER BY planned_at ASC NULLS LAST, r.name' : ' ORDER BY r.name';
    const result = await pool.query(query, params);
    const rows = result.rows;
    const recipeIds = rows.map((row) => row.id).filter((id) => Number.isInteger(id) && id > 0);
    if (recipeIds.length > 0) {
      const ingResult = await pool.query(
        `SELECT ri.recipe_id, ri.ingredient_id, ri.qty, ri.measurement_id, ri.comment, ri.is_optional,
                i.name as ingredient_name, i.details as ingredient_details, i.shopping_measure,
                i.kcal, i.kcal_qty, i.kcal_measurement_id, i.ingredient_unit_grams, i.shopping_measure_grams,
                m.name as measurement_name,
                m.to_grams as measurement_to_grams,
                km.name as kcal_measurement_name,
                km.to_grams as kcal_measurement_to_grams
         FROM recipe.recipe_ingredients ri
         JOIN items i ON ri.ingredient_id = i.id
         LEFT JOIN common.measurements m ON ri.measurement_id = m.id
         LEFT JOIN common.measurements km ON i.kcal_measurement_id = km.id
         WHERE ri.recipe_id = ANY($1::int[])`,
        [recipeIds]
      );
      const totalsByRecipe = new Map();
      for (const r of ingResult.rows) {
        const lineKcal = recipeLineKcal(r);
        if (lineKcal == null || !Number.isFinite(lineKcal)) continue;
        const rid = Number(r.recipe_id);
        totalsByRecipe.set(rid, (totalsByRecipe.get(rid) || 0) + lineKcal);
      }
      for (const row of rows) {
        const id = Number(row.id);
        row.recipe_total_kcal = totalsByRecipe.has(id)
          ? Math.round(totalsByRecipe.get(id))
          : null;
      }
    } else {
      for (const row of rows) {
        row.recipe_total_kcal = null;
      }
    }
    res.json(rows);
  } catch (error) {
    console.error('Error fetching recipes:', error);
    res.status(500).json({ error: 'Failed to fetch recipes' });
  }
});

app.get('/api/recipes/:id', async (req, res) => {
  try {
    const recipeResult = await pool.query(
      `SELECT r.id, r.name, r.servings, r.instructions,
              (
                SELECT MIN(m.meal_date)
                FROM mealplanner.meals m
                WHERE m.recipe_id = r.id
              ) AS planned_at
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
              i.kcal, i.kcal_qty, i.kcal_measurement_id, i.ingredient_unit_grams, i.shopping_measure_grams,
              m.name as measurement_name,
              m.to_grams as measurement_to_grams,
              km.name as kcal_measurement_name,
              km.to_grams as kcal_measurement_to_grams
       FROM recipe.recipe_ingredients ri
       JOIN items i ON ri.ingredient_id = i.id
       LEFT JOIN common.department d ON i.department = d.id
       LEFT JOIN common.measurements m ON ri.measurement_id = m.id
       LEFT JOIN common.measurements km ON i.kcal_measurement_id = km.id
       WHERE ri.recipe_id = $1
       ORDER BY d.name, i.name, i.details`,
      [req.params.id]
    );
    let recipeTotalKcal = 0;
    let recipeTotalKcalLines = 0;
    recipe.ingredients = ingResult.rows.map((r) => {
      const lineGrams = recipeLineGrams(r);
      const lineKcal = recipeLineKcal(r);
      if (lineKcal != null && Number.isFinite(lineKcal)) {
        recipeTotalKcal += lineKcal;
        recipeTotalKcalLines += 1;
      }
      return {
        ingredient_id: r.ingredient_id,
        qty: r.qty,
        measurement_id: r.measurement_id,
        comment: r.comment,
        is_optional: r.is_optional,
        ingredient_name: r.ingredient_name,
        ingredient_details: r.ingredient_details,
        shopping_measure: r.shopping_measure,
        measurement_name: r.measurement_name,
        line_grams: lineGrams,
        line_kcal: lineKcal,
      };
    });
    recipe.recipe_total_kcal =
      recipeTotalKcalLines > 0 ? Math.round(recipeTotalKcal) : null;
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
    const recipeCheck = await pool.query(
      'SELECT id, name, servings, instructions FROM recipe.recipe WHERE id = $1',
      [recipeId]
    );
    if (recipeCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Recipe not found' });
    }
    if (planned) {
      await pool.query(
        `INSERT INTO mealplanner.meals (meal_date, meal_slot_id, recipe_id)
         VALUES (now(), 4, $1)`,
        [recipeId]
      );
    } else {
      await pool.query('DELETE FROM mealplanner.meals WHERE recipe_id = $1', [recipeId]);
    }
    const result = await pool.query(
      `SELECT r.id, r.name, r.servings, r.instructions,
              (
                SELECT MIN(m.meal_date)
                FROM mealplanner.meals m
                WHERE m.recipe_id = r.id
              ) AS planned_at
       FROM recipe.recipe r
       WHERE r.id = $1`,
      [recipeId]
    );
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating recipe planned:', error);
    res.status(500).json({ error: 'Failed to update recipe planned state' });
  }
});

app.get('/api/meal-planner', async (req, res) => {
  try {
    const startDate = req.query.start ? parseDateOnly(req.query.start) : startOfWeekMondayUtc();
    if (!startDate) {
      return res.status(400).json({ error: 'start must be YYYY-MM-DD' });
    }
    const weekStart = formatDateOnly(startDate);
    const endDate = new Date(startDate);
    endDate.setUTCDate(endDate.getUTCDate() + 6);
    const weekEnd = formatDateOnly(endDate);

    let slots = [];
    try {
      const slotColsResult = await pool.query(
        `SELECT column_name
         FROM information_schema.columns
         WHERE table_schema = 'mealplanner' AND table_name = 'meal_slot'`
      );
      const slotCols = new Set((slotColsResult.rows || []).map((r) => r.column_name));
      const hasSeq = slotCols.has('seq');
      const hasServings = slotCols.has('servings');
      const hasKcal = slotCols.has('kcal');
      const slotResult = await pool.query(
        `SELECT id, name, ${
          hasSeq ? 'seq' : 'id'
        } AS seq, ${
          hasServings ? 'servings' : '4'
        }::integer AS servings, ${
          hasKcal ? 'kcal' : 'NULL'
        }::integer AS kcal
         FROM mealplanner.meal_slot
         ORDER BY ${hasSeq ? 'seq' : 'id'}, id`
      );
      slots = slotResult.rows || [];
    } catch (error) {
      if (error?.code !== '42P01') throw error;
    }
    if (slots.length === 0) {
      slots = [{ id: 4, name: 'Dinner', seq: 4, servings: 4, kcal: null }];
    }
    const slotServingsById = new Map(slots.map((slot) => [String(slot.id), slot.servings]));

    let mealRows = [];
    try {
      const mealColsResult = await pool.query(
        `SELECT column_name
         FROM information_schema.columns
         WHERE table_schema = 'mealplanner' AND table_name = 'meals'`
      );
      const mealCols = new Set((mealColsResult.rows || []).map((r) => r.column_name));
      const hasMealId = mealCols.has('id');
      const hasMealSlotId = mealCols.has('meal_slot_id');
      const hasMealServings = mealCols.has('servings');
      const hasLeftoverFrom = mealCols.has('leftover_from_meal_id');
      const hasLeftoverServings = mealCols.has('leftover_servings');
      const hasShopSync = mealCols.has('ingredients_added_to_shopping_at');
      const mealsResult = await pool.query(
        `SELECT ${
          hasMealId ? 'm.id' : 'NULL'
        }::integer AS meal_id, (m.meal_date::date)::text AS meal_day, ${
          hasMealSlotId ? 'm.meal_slot_id' : '4'
        }::integer AS meal_slot_id,
                r.id AS recipe_id, r.name AS recipe_name, r.servings AS recipe_servings,
                ${hasMealServings ? 'm.servings' : 'NULL'}::integer AS meal_servings,
                ${hasLeftoverFrom ? 'm.leftover_from_meal_id' : 'NULL'}::integer AS leftover_from_meal_id,
                ${hasLeftoverServings ? 'm.leftover_servings' : 'NULL'}::numeric AS leftover_servings,
                ${
                  hasShopSync ? 'm.ingredients_added_to_shopping_at' : 'NULL::timestamptz'
                } AS ingredients_added_to_shopping_at
         FROM mealplanner.meals m
         JOIN recipe.recipe r ON r.id = m.recipe_id
         WHERE m.meal_date::date BETWEEN $1::date AND $2::date
         ORDER BY m.meal_date DESC`,
        [weekStart, weekEnd]
      );
      mealRows = mealsResult.rows || [];
    } catch (error) {
      if (error?.code !== '42P01') throw error;
    }

    const recipeIds = [...new Set((mealRows || []).map((row) => row.recipe_id).filter(Boolean))];
    let kcalPerServingByRecipe = new Map();
    if (recipeIds.length > 0) {
      const kcalRows = await pool.query(
        `SELECT ri.recipe_id, ri.qty, ri.measurement_id,
                im.name AS measurement_name, im.to_grams,
                i.kcal, i.kcal_qty,
                km.name AS kcal_measurement_name, km.to_grams AS kcal_to_grams,
                i.ingredient_unit_grams, i.shopping_measure_grams,
                r.servings AS recipe_servings
         FROM recipe.recipe_ingredients ri
         JOIN recipe.recipe r ON r.id = ri.recipe_id
         JOIN items i ON i.id = ri.ingredient_id
         LEFT JOIN common.measurements im ON im.id = ri.measurement_id
         LEFT JOIN common.measurements km ON km.id = i.kcal_measurement_id
         WHERE ri.recipe_id = ANY($1::int[])`,
        [recipeIds]
      );
      kcalPerServingByRecipe = computeRecipeKcalPerServing(kcalRows.rows || []);
    }

    const byDayAndSlot = new Map();
    const mealById = new Map();
    for (const row of mealRows) {
      mealById.set(row.meal_id, row);
      const key = `${row.meal_day}::${row.meal_slot_id}`;
      if (!byDayAndSlot.has(key)) {
        byDayAndSlot.set(key, {
          meal_id: row.meal_id,
          id: row.recipe_id,
          name: row.recipe_name,
          servings:
            row.meal_servings ??
            slotServingsById.get(String(row.meal_slot_id)) ??
            row.recipe_servings,
          kcal_per_serving: kcalPerServingByRecipe.get(row.recipe_id) ?? null,
          leftover_from_meal_id: row.leftover_from_meal_id ?? null,
          leftover_servings:
            row.leftover_servings != null ? parseFloat(row.leftover_servings) : null,
          ingredients_added_to_shopping_at: row.ingredients_added_to_shopping_at ?? null,
        });
      }
    }

    const days = [];
    for (let i = 0; i < 7; i += 1) {
      const d = new Date(startDate);
      d.setUTCDate(d.getUTCDate() + i);
      const day = formatDateOnly(d);
      days.push({
        date: day,
        slots: slots.map((slot) => ({
          id: slot.id,
          name: slot.name,
          seq: slot.seq,
          servings: slot.servings,
          kcal: slot.kcal != null ? parseInt(slot.kcal, 10) : null,
          meal: byDayAndSlot.get(`${day}::${slot.id}`) || null,
        })),
      });
    }

    const slotNameById = new Map(slots.map((slot) => [slot.id, slot.name]));
    for (const day of days) {
      for (const slot of day.slots) {
        if (!slot.meal?.leftover_from_meal_id) continue;
        const source = mealById.get(slot.meal.leftover_from_meal_id);
        if (!source) continue;
        slot.meal.leftover_source = {
          meal_id: source.meal_id,
          meal_date: source.meal_day,
          meal_slot_id: source.meal_slot_id,
          meal_slot_name: slotNameById.get(source.meal_slot_id) || null,
        };
      }
    }

    return res.json({
      start_date: weekStart,
      end_date: weekEnd,
      days,
    });
  } catch (error) {
    console.error('Error fetching meal planner:', error);
    return res.status(500).json({ error: 'Failed to fetch meal planner' });
  }
});

app.get('/api/meal-planner/meal-slots', async (req, res) => {
  try {
    const slotCols = await fetchMealSlotColumnSet();
    if (slotCols.size === 0) {
      return res.json({ slots: [], supported: false });
    }
    const hasSeq = slotCols.has('seq');
    const hasServings = slotCols.has('servings');
    const hasKcal = slotCols.has('kcal');
    const slotResult = await pool.query(
      `SELECT id, name, ${hasSeq ? 'seq' : 'id'} AS seq, ${
        hasServings ? 'servings' : '4'
      }::integer AS servings, ${hasKcal ? 'kcal' : 'NULL'}::integer AS kcal
       FROM mealplanner.meal_slot
       ORDER BY ${hasSeq ? 'seq' : 'id'}, id`
    );
    return res.json({ slots: slotResult.rows || [], supported: true });
  } catch (error) {
    if (error?.code === '42P01') {
      return res.json({ slots: [], supported: false });
    }
    console.error('Error fetching meal slots:', error);
    return res.status(500).json({ error: 'Failed to fetch meal slots' });
  }
});

app.post('/api/meal-planner/meal-slots', async (req, res) => {
  try {
    const slotCols = await fetchMealSlotColumnSet();
    if (!slotCols.has('name')) {
      return res.status(503).json({ error: 'Meal planner meal slots are not available' });
    }
    const name = String(req.body?.name || '').trim();
    if (!name || name.length > 80) {
      return res.status(400).json({ error: 'name is required (max 80 characters)' });
    }

    let seq = parseInt(req.body?.seq, 10);
    if (Number.isNaN(seq) || seq < 1) {
      if (!slotCols.has('seq')) {
        seq = 1;
      } else {
        const maxR = await pool.query(
          'SELECT COALESCE(MAX(seq), 0) + 1 AS n FROM mealplanner.meal_slot'
        );
        seq = parseInt(maxR.rows[0].n, 10) || 1;
      }
    }

    let servings = parseInt(req.body?.servings, 10);
    if (Number.isNaN(servings) || servings < 1) {
      servings = 4;
    }

    const kcalRaw = req.body?.kcal;
    const kcal =
      kcalRaw == null || kcalRaw === '' ? null : parseInt(kcalRaw, 10);
    if (kcal != null && (Number.isNaN(kcal) || kcal < 1)) {
      return res.status(400).json({ error: 'kcal must be null or a positive integer' });
    }

    const cols = ['name'];
    const vals = [];
    const params = [];
    let pi = 1;
    params.push(name);
    vals.push(`$${pi}`);
    pi += 1;
    if (slotCols.has('seq')) {
      cols.push('seq');
      params.push(seq);
      vals.push(`$${pi}`);
      pi += 1;
    }
    if (slotCols.has('servings')) {
      cols.push('servings');
      params.push(servings);
      vals.push(`$${pi}`);
      pi += 1;
    }
    if (slotCols.has('kcal')) {
      cols.push('kcal');
      params.push(kcal);
      vals.push(`$${pi}`);
      pi += 1;
    }

    const returningCols = ['id', 'name'];
    if (slotCols.has('seq')) returningCols.push('seq');
    if (slotCols.has('servings')) returningCols.push('servings');
    if (slotCols.has('kcal')) returningCols.push('kcal');
    const insertResult = await pool.query(
      `INSERT INTO mealplanner.meal_slot (${cols.join(', ')})
       VALUES (${vals.join(', ')})
       RETURNING ${returningCols.join(', ')}`,
      params
    );
    const row = insertResult.rows[0];
    return res.status(201).json({
      slot: {
        id: row.id,
        name: row.name,
        seq: row.seq != null ? parseInt(row.seq, 10) : seq,
        servings: row.servings != null ? parseInt(row.servings, 10) : servings,
        kcal: row.kcal != null ? parseInt(row.kcal, 10) : kcal,
      },
    });
  } catch (error) {
    if (error?.code === '23505') {
      return res.status(409).json({ error: 'A meal slot with this name already exists' });
    }
    if (error?.code === '42P01') {
      return res.status(503).json({ error: 'Meal planner meal slots are not available' });
    }
    console.error('Error creating meal slot:', error);
    return res.status(500).json({ error: 'Failed to create meal slot' });
  }
});

app.patch('/api/meal-planner/meal-slots/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id) || id < 1) {
      return res.status(400).json({ error: 'Invalid meal slot id' });
    }
    const slotCols = await fetchMealSlotColumnSet();
    if (!slotCols.has('name')) {
      return res.status(503).json({ error: 'Meal planner meal slots are not available' });
    }

    const updates = [];
    const params = [];
    let pi = 1;

    if (req.body?.name !== undefined) {
      const name = String(req.body.name || '').trim();
      if (!name || name.length > 80) {
        return res.status(400).json({ error: 'name must be 1–80 characters' });
      }
      updates.push(`name = $${pi}`);
      params.push(name);
      pi += 1;
    }
    if (req.body?.seq !== undefined && slotCols.has('seq')) {
      const seq = parseInt(req.body.seq, 10);
      if (Number.isNaN(seq) || seq < 1) {
        return res.status(400).json({ error: 'seq must be a positive integer' });
      }
      updates.push(`seq = $${pi}`);
      params.push(seq);
      pi += 1;
    }
    if (req.body?.servings !== undefined && slotCols.has('servings')) {
      const servings = parseInt(req.body.servings, 10);
      if (Number.isNaN(servings) || servings < 1) {
        return res.status(400).json({ error: 'servings must be a positive integer' });
      }
      updates.push(`servings = $${pi}`);
      params.push(servings);
      pi += 1;
    }
    if (req.body?.kcal !== undefined && slotCols.has('kcal')) {
      const kcalRaw = req.body.kcal;
      const kcal = kcalRaw == null || kcalRaw === '' ? null : parseInt(kcalRaw, 10);
      if (kcal != null && (Number.isNaN(kcal) || kcal < 1)) {
        return res.status(400).json({ error: 'kcal must be null or a positive integer' });
      }
      updates.push(`kcal = $${pi}`);
      params.push(kcal);
      pi += 1;
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    params.push(id);
    const returningCols = ['id', 'name'];
    if (slotCols.has('seq')) returningCols.push('seq');
    if (slotCols.has('servings')) returningCols.push('servings');
    if (slotCols.has('kcal')) returningCols.push('kcal');
    const updateResult = await pool.query(
      `UPDATE mealplanner.meal_slot
       SET ${updates.join(', ')}
       WHERE id = $${pi}
       RETURNING ${returningCols.join(', ')}`,
      params
    );

    if (updateResult.rows.length === 0) {
      return res.status(404).json({ error: 'Meal slot not found' });
    }
    const row = updateResult.rows[0];
    return res.json({
      slot: {
        id: row.id,
        name: row.name,
        seq: row.seq != null ? parseInt(row.seq, 10) : id,
        servings: row.servings != null ? parseInt(row.servings, 10) : null,
        kcal: row.kcal != null ? parseInt(row.kcal, 10) : null,
      },
    });
  } catch (error) {
    if (error?.code === '23505') {
      return res.status(409).json({ error: 'A meal slot with this name already exists' });
    }
    console.error('Error updating meal slot:', error);
    return res.status(500).json({ error: 'Failed to update meal slot' });
  }
});

app.put('/api/meal-planner/meal-slots/order', async (req, res) => {
  let client;
  try {
    const slotCols = await fetchMealSlotColumnSet();
    if (!slotCols.has('seq')) {
      return res.status(503).json({ error: 'Meal slot ordering is not supported' });
    }
    const orderedIds = req.body?.ordered_ids;
    if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
      return res.status(400).json({ error: 'ordered_ids must be a non-empty array' });
    }
    const ids = orderedIds.map((x) => parseInt(x, 10)).filter((n) => Number.isInteger(n) && n > 0);
    if (ids.length !== orderedIds.length) {
      return res.status(400).json({ error: 'ordered_ids must contain positive integers only' });
    }

    client = await pool.connect();
    await client.query('BEGIN');
    const existing = await client.query('SELECT id FROM mealplanner.meal_slot ORDER BY seq, id');
    const existingIds = (existing.rows || []).map((r) => r.id);
    if (ids.length !== existingIds.length) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'ordered_ids must list every meal slot exactly once' });
    }
    const setExisting = new Set(existingIds);
    for (const slotId of ids) {
      if (!setExisting.has(slotId)) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'ordered_ids contains an unknown meal slot id' });
      }
    }

    for (let i = 0; i < ids.length; i += 1) {
      await client.query('UPDATE mealplanner.meal_slot SET seq = $1 WHERE id = $2', [i + 1, ids[i]]);
    }
    await client.query('COMMIT');
    const hasServings = slotCols.has('servings');
    const hasKcal = slotCols.has('kcal');
    const list = await pool.query(
      `SELECT id, name, seq, ${hasServings ? 'servings' : '4'}::integer AS servings, ${
        hasKcal ? 'kcal' : 'NULL::integer'
      } AS kcal
       FROM mealplanner.meal_slot
       ORDER BY seq, id`
    );
    return res.json({ slots: list.rows || [] });
  } catch (error) {
    if (client) {
      try {
        await client.query('ROLLBACK');
      } catch (_) {
        /* ignore: may not be in a transaction */
      }
    }
    console.error('Error reordering meal slots:', error);
    return res.status(500).json({ error: 'Failed to reorder meal slots' });
  } finally {
    if (client) client.release();
  }
});

app.delete('/api/meal-planner/meal-slots/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id) || id < 1) {
      return res.status(400).json({ error: 'Invalid meal slot id' });
    }
    const countSlots = await pool.query('SELECT COUNT(*)::int AS n FROM mealplanner.meal_slot');
    const nSlots = countSlots.rows[0]?.n ?? 0;
    if (nSlots <= 1) {
      return res.status(400).json({ error: 'Cannot delete the last meal slot' });
    }
    const mealCount = await pool.query(
      'SELECT COUNT(*)::int AS n FROM mealplanner.meals WHERE meal_slot_id = $1',
      [id]
    );
    const nMeals = mealCount.rows[0]?.n ?? 0;
    if (nMeals > 0) {
      return res.status(409).json({
        error: 'This slot has planned meals; clear or reassign them before deleting the slot',
      });
    }
    const del = await pool.query('DELETE FROM mealplanner.meal_slot WHERE id = $1 RETURNING id', [id]);
    if (del.rows.length === 0) {
      return res.status(404).json({ error: 'Meal slot not found' });
    }
    return res.json({ deleted_id: id });
  } catch (error) {
    if (error?.code === '42P01') {
      return res.status(503).json({ error: 'Meal planner meal slots are not available' });
    }
    console.error('Error deleting meal slot:', error);
    return res.status(500).json({ error: 'Failed to delete meal slot' });
  }
});

app.put('/api/meal-planner/assign', async (req, res) => {
  const mealDate = parseDateOnly(req.body?.meal_date);
  const slotId = parseInt(req.body?.meal_slot_id, 10);
  const sourceMealDate = req.body?.source_meal_date ? parseDateOnly(req.body.source_meal_date) : null;
  const sourceSlotId = req.body?.source_meal_slot_id != null ? parseInt(req.body.source_meal_slot_id, 10) : null;
  if (!mealDate) {
    return res.status(400).json({ error: 'meal_date must be YYYY-MM-DD' });
  }
  if (Number.isNaN(slotId) || slotId < 1) {
    return res.status(400).json({ error: 'meal_slot_id is required' });
  }

  const recipeIdRaw = req.body?.recipe_id;
  const recipeId = recipeIdRaw == null ? null : parseInt(recipeIdRaw, 10);
  const leftoverFromRaw = req.body?.leftover_from_meal_id;
  const leftoverFromMealId = leftoverFromRaw == null ? null : parseInt(leftoverFromRaw, 10);
  const leftoverServingsRaw = req.body?.leftover_servings;
  const leftoverServings =
    leftoverServingsRaw == null || leftoverServingsRaw === ''
      ? null
      : parseItemNumber(leftoverServingsRaw);
  if (recipeIdRaw != null && (Number.isNaN(recipeId) || recipeId < 1)) {
    return res.status(400).json({ error: 'recipe_id must be null or a positive integer' });
  }
  if (leftoverFromRaw != null && (Number.isNaN(leftoverFromMealId) || leftoverFromMealId < 1)) {
    return res.status(400).json({ error: 'leftover_from_meal_id must be a positive integer or null' });
  }
  if (leftoverServings != null && (!Number.isFinite(leftoverServings) || leftoverServings <= 0)) {
    return res.status(400).json({ error: 'leftover_servings must be a positive number or null' });
  }

  const mealDateText = formatDateOnly(mealDate);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const mealColsResult = await client.query(
      `SELECT column_name
       FROM information_schema.columns
       WHERE table_schema = 'mealplanner' AND table_name = 'meals'`
    );
    const mealCols = new Set((mealColsResult.rows || []).map((r) => r.column_name));
    const hasMealId = mealCols.has('id');
    const hasMealServings = mealCols.has('servings');
    const hasLeftoverFrom = mealCols.has('leftover_from_meal_id');
    const hasLeftoverServings = mealCols.has('leftover_servings');

    await client.query(
      `DELETE FROM mealplanner.meals
       WHERE meal_date::date = $1::date AND meal_slot_id = $2`,
      [mealDateText, slotId]
    );

    if (recipeId == null) {
      await client.query('COMMIT');
      return res.json({ meal_date: mealDateText, meal_slot_id: slotId, meal: null });
    }

    const recipeCheck = await client.query(
      'SELECT id, name, servings FROM recipe.recipe WHERE id = $1',
      [recipeId]
    );
    if (recipeCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Recipe not found' });
    }

    const recipeRow = recipeCheck.rows[0];
    let assignServings = Math.max(1, parseInt(recipeRow.servings, 10) || 1);

    if (sourceMealDate && Number.isInteger(sourceSlotId) && sourceSlotId > 0) {
      if (hasMealServings) {
        const sourceMealResult = await client.query(
          `SELECT servings
           FROM mealplanner.meals
           WHERE meal_date::date = $1::date AND meal_slot_id = $2
           LIMIT 1`,
          [formatDateOnly(sourceMealDate), sourceSlotId]
        );
        const sourceServings = parseInt(sourceMealResult.rows?.[0]?.servings, 10);
        if (Number.isInteger(sourceServings) && sourceServings >= 1) {
          assignServings = sourceServings;
        }
      }
      await client.query(
        `DELETE FROM mealplanner.meals
         WHERE meal_date::date = $1::date AND meal_slot_id = $2 AND recipe_id = $3`,
        [formatDateOnly(sourceMealDate), sourceSlotId, recipeId]
      );
    }

    const insertColumns = ['meal_date', 'meal_slot_id', 'recipe_id'];
    const insertValues = ["($1::date + interval '12 hour')", '$2', '$3'];
    const params = [mealDateText, slotId, recipeId];
    if (hasMealServings) {
      insertColumns.push('servings');
      params.push(assignServings);
      insertValues.push(`$${params.length}`);
    }
    if (hasLeftoverFrom) {
      insertColumns.push('leftover_from_meal_id');
      params.push(leftoverFromMealId);
      insertValues.push(`$${params.length}`);
    }
    if (hasLeftoverServings) {
      insertColumns.push('leftover_servings');
      params.push(leftoverServings);
      insertValues.push(`$${params.length}`);
    }
    const insertMealResult = await client.query(
      `INSERT INTO mealplanner.meals (${insertColumns.join(', ')})
       VALUES (${insertValues.join(', ')})${
         hasMealId ? '\n       RETURNING id' : ''
       }`,
      params
    );

    await client.query('COMMIT');
    return res.json({
      meal_date: mealDateText,
      meal_slot_id: slotId,
      meal: {
        meal_id: hasMealId ? (insertMealResult.rows?.[0]?.id ?? null) : null,
        ...recipeCheck.rows[0],
        servings: assignServings,
        leftover_from_meal_id: leftoverFromMealId,
        leftover_servings: leftoverServings,
      },
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error assigning meal planner meal:', error);
    return res.status(500).json({ error: 'Failed to assign meal planner meal' });
  } finally {
    client.release();
  }
});

app.patch('/api/meal-planner/servings', async (req, res) => {
  try {
    const mealDate = parseDateOnly(req.body?.meal_date);
    const slotId = parseInt(req.body?.meal_slot_id, 10);
    const servings = parseInt(req.body?.servings, 10);
    if (!mealDate) {
      return res.status(400).json({ error: 'meal_date must be YYYY-MM-DD' });
    }
    if (Number.isNaN(slotId) || slotId < 1) {
      return res.status(400).json({ error: 'meal_slot_id is required' });
    }
    if (Number.isNaN(servings) || servings < 1) {
      return res.status(400).json({ error: 'servings must be a positive integer' });
    }

    const mealColsResult = await pool.query(
      `SELECT column_name
       FROM information_schema.columns
       WHERE table_schema = 'mealplanner' AND table_name = 'meals'`
    );
    const mealCols = new Set((mealColsResult.rows || []).map((r) => r.column_name));
    if (!mealCols.has('servings')) {
      return res.status(400).json({ error: 'meal servings are not supported by this database schema' });
    }

    const mealDateText = formatDateOnly(mealDate);
    const hasShopSync = mealCols.has('ingredients_added_to_shopping_at');
    const shopClear = hasShopSync ? ', ingredients_added_to_shopping_at = NULL' : '';
    const updateSql = mealCols.has('modified')
      ? `UPDATE mealplanner.meals
         SET servings = $3, modified = CURRENT_TIMESTAMP${shopClear}
         WHERE meal_date::date = $1::date AND meal_slot_id = $2
         RETURNING recipe_id, servings`
      : `UPDATE mealplanner.meals
         SET servings = $3${shopClear}
         WHERE meal_date::date = $1::date AND meal_slot_id = $2
         RETURNING recipe_id, servings`;
    const result = await pool.query(updateSql, [mealDateText, slotId, servings]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Meal slot not assigned' });
    }
    return res.json({
      meal_date: mealDateText,
      meal_slot_id: slotId,
      servings: result.rows[0].servings,
      recipe_id: result.rows[0].recipe_id,
    });
  } catch (error) {
    console.error('Error updating meal servings:', error);
    return res.status(500).json({ error: 'Failed to update meal servings' });
  }
});

app.patch('/api/meal-planner/slot-kcal', async (req, res) => {
  try {
    const slotId = parseInt(req.body?.meal_slot_id, 10);
    const kcalRaw = req.body?.kcal;
    const kcal = kcalRaw == null || kcalRaw === '' ? null : parseInt(kcalRaw, 10);
    if (Number.isNaN(slotId) || slotId < 1) {
      return res.status(400).json({ error: 'meal_slot_id is required' });
    }
    if (kcal != null && (Number.isNaN(kcal) || kcal < 1)) {
      return res.status(400).json({ error: 'kcal must be null or a positive integer' });
    }

    const slotColsResult = await pool.query(
      `SELECT column_name
       FROM information_schema.columns
       WHERE table_schema = 'mealplanner' AND table_name = 'meal_slot'`
    );
    const slotCols = new Set((slotColsResult.rows || []).map((r) => r.column_name));
    if (!slotCols.has('kcal')) {
      return res.status(400).json({ error: 'meal slot kcal is not supported by this database schema' });
    }

    const updateResult = await pool.query(
      `UPDATE mealplanner.meal_slot
       SET kcal = $2
       WHERE id = $1
       RETURNING id, kcal`,
      [slotId, kcal]
    );
    if (updateResult.rows.length === 0) {
      return res.status(404).json({ error: 'Meal slot not found' });
    }
    return res.json({
      meal_slot_id: updateResult.rows[0].id,
      kcal: updateResult.rows[0].kcal != null ? parseInt(updateResult.rows[0].kcal, 10) : null,
    });
  } catch (error) {
    console.error('Error updating meal slot kcal:', error);
    return res.status(500).json({ error: 'Failed to update meal slot kcal' });
  }
});

app.post('/api/meal-planner/leftovers/auto-link', async (req, res) => {
  const sourceMealDate = parseDateOnly(req.body?.source_meal_date);
  const sourceSlotId = parseInt(req.body?.source_meal_slot_id, 10);
  if (!sourceMealDate) {
    return res.status(400).json({ error: 'source_meal_date must be YYYY-MM-DD' });
  }
  if (Number.isNaN(sourceSlotId) || sourceSlotId < 1) {
    return res.status(400).json({ error: 'source_meal_slot_id is required' });
  }

  const sourceDateText = formatDateOnly(sourceMealDate);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const mealColsResult = await client.query(
      `SELECT column_name
       FROM information_schema.columns
       WHERE table_schema = 'mealplanner' AND table_name = 'meals'`
    );
    const mealCols = new Set((mealColsResult.rows || []).map((r) => r.column_name));
    const hasMealId = mealCols.has('id');
    const hasMealServings = mealCols.has('servings');
    const hasLeftoverFrom = mealCols.has('leftover_from_meal_id');
    const hasLeftoverServings = mealCols.has('leftover_servings');
    if (!hasMealId || !hasMealServings || !hasLeftoverFrom || !hasLeftoverServings) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'leftovers are not supported by this database schema' });
    }

    const sourceResult = await client.query(
      `SELECT m.id, m.recipe_id, m.servings, ms.servings AS slot_servings
       FROM mealplanner.meals m
       JOIN mealplanner.meal_slot ms ON ms.id = m.meal_slot_id
       WHERE m.meal_date::date = $1::date AND m.meal_slot_id = $2
       LIMIT 1`,
      [sourceDateText, sourceSlotId]
    );
    if (sourceResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Source meal not found' });
    }
    const sourceMeal = sourceResult.rows[0];
    const sourceServings = parseItemNumber(sourceMeal.servings) || 0;
    const sourceSlotServings = parseItemNumber(sourceMeal.slot_servings) || 0;
    let remaining = sourceServings - sourceSlotServings;
    if (remaining <= 0) {
      await client.query('COMMIT');
      return res.json({ linked: [], leftover_servings_remaining: 0 });
    }

    const lunchSlotResult = await client.query(
      `SELECT id, servings
       FROM mealplanner.meal_slot
       WHERE lower(name) = 'lunch'
       ORDER BY seq, id
       LIMIT 1`
    );
    if (lunchSlotResult.rows.length === 0) {
      await client.query('COMMIT');
      return res.json({ linked: [], leftover_servings_remaining: remaining });
    }
    const lunchSlotId = lunchSlotResult.rows[0].id;
    const lunchSlotServings = parseItemNumber(lunchSlotResult.rows[0].servings) || 1;

    const linked = [];
    const maxDaysToTry = 14;
    for (let dayOffset = 1; dayOffset <= maxDaysToTry && remaining > 0; dayOffset += 1) {
      const targetDate = new Date(sourceMealDate);
      targetDate.setUTCDate(targetDate.getUTCDate() + dayOffset);
      const targetDateText = formatDateOnly(targetDate);
      const existingResult = await client.query(
        `SELECT id
         FROM mealplanner.meals
         WHERE meal_date::date = $1::date AND meal_slot_id = $2
         LIMIT 1`,
        [targetDateText, lunchSlotId]
      );
      if (existingResult.rows.length > 0) continue;

      const useServings = Math.min(remaining, lunchSlotServings);
      const insertResult = await client.query(
        `INSERT INTO mealplanner.meals (meal_date, meal_slot_id, recipe_id, servings, leftover_from_meal_id, leftover_servings)
         VALUES (($1::date + interval '12 hour'), $2, $3, $4, $5, $6)
         RETURNING id`,
        [targetDateText, lunchSlotId, sourceMeal.recipe_id, useServings, sourceMeal.id, useServings]
      );
      linked.push({
        meal_id: insertResult.rows[0].id,
        meal_date: targetDateText,
        meal_slot_id: lunchSlotId,
        servings: useServings,
      });
      remaining -= useServings;
    }

    await client.query('COMMIT');
    return res.json({
      linked,
      leftover_servings_remaining: Math.max(0, Math.round(remaining * 100) / 100),
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error auto-linking leftovers:', error);
    return res.status(500).json({ error: 'Failed to auto-link leftovers' });
  } finally {
    client.release();
  }
});

/** Add non-optional recipe lines to shopping list (items.qty in grams). Always increments. */
async function addRecipeIngredientsToShoppingListTx(client, recipeId, scale) {
  const lines = await client.query(
    `SELECT ri.ingredient_id, ri.qty, ri.is_optional, ri.measurement_id,
            im.name AS measurement_name, im.to_grams,
            i.name AS ingredient_name,
            i.qty AS item_qty_before,
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
    const grams = recipeLineGramsScaled(row, scale);
    if (grams == null || grams <= 0) {
      skip(row, 'unresolved_grams', {
        qty: row.qty,
        scale,
        measurement_id: row.measurement_id,
        measurement_name: row.measurement_name,
      });
      continue;
    }
    const qtyBefore =
      row.item_qty_before != null ? Number(row.item_qty_before) : 0;
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
      scale,
      grams_added: grams,
      qty_before: qtyBefore,
      qty_after: upd.rows[0].qty,
      was_on_shopping_list: qtyBefore > 0,
    });
  }
  return { added, skipped };
}

// Add recipe ingredients to shopping list: resolve grams per line (Each, Shopping Unit, or to_grams)
app.post('/api/recipes/:id/shopping-list', async (req, res) => {
  const recipeId = parseInt(req.params.id, 10);
  if (Number.isNaN(recipeId) || recipeId < 1) {
    return res.status(400).json({ error: 'Invalid recipe id' });
  }
  const scale = normalizeRecipeScale(req.body?.scale);
  if (scale == null) {
    return res.status(400).json({ error: 'scale must be one of: 0.5, 1, 2, 3, 4, 5' });
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const recipeCheck = await client.query('SELECT id FROM recipe.recipe WHERE id = $1', [recipeId]);
    if (recipeCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Recipe not found' });
    }
    const { added, skipped } = await addRecipeIngredientsToShoppingListTx(client, recipeId, scale);
    await client.query(
      `INSERT INTO mealplanner.meals (meal_date, meal_slot_id, recipe_id)
       VALUES (now(), 4, $1)`,
      [recipeId]
    );
    await client.query('COMMIT');
    res.status(201).json({ added, skipped, scale });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error adding recipe to shopping list:', error);
    res.status(500).json({ error: 'Failed to add recipe to shopping list', message: error.message });
  } finally {
    client.release();
  }
});

app.post('/api/meal-planner/add-to-shopping-list', async (req, res) => {
  const startDate = req.body?.start ? parseDateOnly(req.body.start) : null;
  if (!startDate) {
    return res.status(400).json({ error: 'start must be YYYY-MM-DD (week start)' });
  }
  const userScale = normalizeRecipeScale(req.body?.scale);
  if (userScale == null) {
    return res.status(400).json({ error: 'scale must be one of: 0.5, 1, 2, 3, 4, 5' });
  }
  let todayStr = null;
  if (typeof req.body?.today === 'string' && req.body.today.trim()) {
    const parsedToday = parseDateOnly(req.body.today.trim());
    if (parsedToday) {
      todayStr = formatDateOnly(parsedToday);
    }
  }
  if (!todayStr) {
    todayStr = plannerTodayDefault();
  }

  const weekStart = formatDateOnly(startDate);
  const endDt = new Date(startDate);
  endDt.setUTCDate(endDt.getUTCDate() + 6);
  const weekEnd = formatDateOnly(endDt);

  const { eligibleStart, eligibleEnd, coversFullWeek } = computeEligibleFutureRangeInWeek(
    startDate,
    todayStr
  );

  const mealColsResult = await pool.query(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_schema = 'mealplanner' AND table_name = 'meals'`
  );
  const mealCols = new Set((mealColsResult.rows || []).map((r) => r.column_name));
  const hasMealId = mealCols.has('id');
  const hasMealServings = mealCols.has('servings');
  const hasLeftoverFrom = mealCols.has('leftover_from_meal_id');
  const hasShopSync = mealCols.has('ingredients_added_to_shopping_at');
  const unsyncedFilter = hasShopSync ? 'AND m.ingredients_added_to_shopping_at IS NULL' : '';
  const nonLeftoverFilter = hasLeftoverFrom ? 'AND m.leftover_from_meal_id IS NULL' : '';

  const mealsSql = `SELECT ${
    hasMealId ? 'm.id' : 'NULL::integer'
  } AS meal_id,
          (m.meal_date::date)::text AS meal_day,
          COALESCE(m.meal_slot_id, 4)::integer AS meal_slot_id,
          m.recipe_id,
          ${hasMealServings ? 'm.servings' : 'NULL::integer'} AS meal_servings_col,
          r.servings AS recipe_servings
     FROM mealplanner.meals m
     JOIN recipe.recipe r ON r.id = m.recipe_id
     WHERE m.meal_date::date BETWEEN $1::date AND $2::date
     AND m.meal_date::date > $3::date
     ${nonLeftoverFilter}
     ${unsyncedFilter}
     ORDER BY m.meal_date, m.meal_slot_id`;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const mealsResult = await client.query(mealsSql, [weekStart, weekEnd, todayStr]);
    const mealsProcessed = [];
    let allAdded = [];
    let allSkipped = [];
    for (const meal of mealsResult.rows) {
      const recipeServings = Math.max(1, Number(meal.recipe_servings) || 1);
      const mealServings =
        meal.meal_servings_col != null && Number(meal.meal_servings_col) > 0
          ? Number(meal.meal_servings_col)
          : recipeServings;
      const lineScale = (mealServings / recipeServings) * userScale;
      const { added, skipped } = await addRecipeIngredientsToShoppingListTx(
        client,
        meal.recipe_id,
        lineScale
      );
      allAdded = allAdded.concat(added);
      allSkipped = allSkipped.concat(skipped);
      if (hasShopSync && added.length > 0) {
        if (meal.meal_id != null) {
          await client.query(
            `UPDATE mealplanner.meals SET ingredients_added_to_shopping_at = now() WHERE id = $1`,
            [meal.meal_id]
          );
        } else {
          await client.query(
            `UPDATE mealplanner.meals SET ingredients_added_to_shopping_at = now()
             WHERE meal_date::date = $1::date AND meal_slot_id = $2`,
            [meal.meal_day, meal.meal_slot_id]
          );
        }
      }
      mealsProcessed.push({
        meal_id: meal.meal_id,
        meal_date: meal.meal_day,
        meal_slot_id: meal.meal_slot_id,
        recipe_id: meal.recipe_id,
        line_scale: lineScale,
        added_count: added.length,
        skipped_count: skipped.length,
      });
    }
    await client.query('COMMIT');
    res.status(201).json({
      start_date: weekStart,
      end_date: weekEnd,
      today_date: todayStr,
      eligible_start_date: eligibleStart,
      eligible_end_date: eligibleEnd,
      eligible_covers_full_week: coversFullWeek,
      scale: userScale,
      meals: mealsProcessed,
      added: allAdded,
      skipped: allSkipped,
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error adding meal planner to shopping list:', error);
    res.status(500).json({ error: 'Failed to add meal planner to shopping list', message: error.message });
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
