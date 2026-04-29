/**
 * KitchenHub backend API tests
 * Run with: npm test
 *
 * Database is mocked so tests run without PostgreSQL.
 */

const request = require('supertest');

function createMockPool(queryImpl) {
  const query = jest.fn().mockImplementation(queryImpl);
  const client = {
    query: jest.fn().mockImplementation(queryImpl),
    release: jest.fn(),
  };
  return {
    query,
    connect: jest.fn().mockResolvedValue(client),
  };
}

/** Default mock: return empty rows for SELECT, one row for INSERT/UPDATE/DELETE RETURNING. Always returns a Promise for pg API. */
function defaultQueryHandler(sql, params) {
  const s = (sql || '').trim();
  const txn = s.toUpperCase();
  if (txn === 'BEGIN' || txn === 'COMMIT' || txn === 'ROLLBACK') {
    return { rows: [] };
  }
  if (s.includes('SELECT id FROM recipe.recipe WHERE id')) {
    return { rows: params?.[0] == 999 ? [] : [{ id: Number(params[0]) }] };
  }
  if (s.includes('SELECT id, name, servings, instructions FROM recipe.recipe WHERE id = $1')) {
    return {
      rows: params?.[0] == 999
        ? []
        : [{ id: Number(params[0]), name: 'Recipe', servings: 2, instructions: 'Mix' }],
    };
  }
  if (s.includes('FROM recipe.recipe r') && s.includes('AS planned_at') && s.includes('WHERE r.id = $1')) {
    return {
      rows: params?.[0] == 999
        ? []
        : [{ id: Number(params[0]), name: 'Recipe', servings: 2, instructions: 'Mix', planned_at: null }],
    };
  }
  if (s.includes('FROM recipe.recipe_ingredients ri') && s.includes('common.measurements im')) {
    return {
      rows: [
        {
          ingredient_id: 1,
          qty: '2',
          is_optional: false,
          measurement_id: 1,
          measurement_name: 'Teaspoon',
          to_grams: '5',
          ingredient_name: 'Test Item',
          ingredient_unit_grams: null,
          shopping_measure_grams: null,
        },
      ],
    };
  }
  if (s.includes('SELECT value FROM config.settings')) return { rows: [{ value: null }] };
  if (s.includes('SELECT * FROM store ORDER BY')) return { rows: [{ id: 1, name: 'Store A', modified: null }] };
  if (s.includes('SELECT * FROM store WHERE id')) return { rows: params?.[0] == 1 ? [{ id: 1, name: 'Store A', modified: null }] : [] };
  if (s.includes('INSERT INTO store')) return { rows: [{ id: 2, name: params?.[0] || 'New', modified: null }] };
  if (s.includes('UPDATE store SET')) return { rows: [{ id: params?.[1], name: params?.[0], modified: null }] };
  if (s.includes('DELETE FROM store')) return { rows: [{ id: params?.[0] }] };
  if (s.includes('SELECT id as departmentid') || s.includes('FROM common.department ORDER BY name')) return { rows: [{ departmentid: 1, department_name: 'Produce' }] };
  if (s.includes('storezones sz') && s.includes('JOIN common.department')) return { rows: [{ storeid: 1, zonesequence: 1, zonename: 'Aisle 1', departmentid: 1, department_name: 'Produce' }] };
  // INSERT/upsert store zone: match RETURNING so we don't match GET zones
  if (s.includes('INSERT INTO storezones') && s.includes('RETURNING *')) return { rows: [{ storeid: 1, zonesequence: 1, zonename: 'General', departmentid: 1 }] };
  if (s.includes('ON CONFLICT (storeid') && s.includes('storezones')) return { rows: [{ storeid: 1, zonesequence: 1, zonename: 'General', departmentid: 1 }] };
  if (s.includes('SELECT * FROM common.department')) return { rows: [{ id: 1, name: 'Produce', ingredient: true }] };
  if (s.includes('INSERT INTO common.department')) {
    return { rows: [{ id: 2, name: params?.[0] || 'New', ingredient: params?.[1] === true }] };
  }
  if (s.includes('UPDATE common.department SET') && s.includes('RETURNING *')) {
    return { rows: [{ id: params?.[params.length - 1], name: 'Produce', ingredient: true }] };
  }
  if (s.includes('FROM items i') && s.includes('LEFT JOIN common.department') && !s.includes('storezones sz')) {
    if (s.includes('WHERE i.id')) return { rows: params?.[0] == 1 ? [{ id: 1, name: 'Item', department: 1, department_name: 'Produce' }] : [] };
    if (s.includes('WHERE i.qty > 0')) {
      // Shopping list GET (by store or all): return rows with selected columns
      return {
        rows: [
          {
            name: 'Milk',
            description: 'Milk',
            quantity: '1',
            purchased: 0,
            department_id: 1,
            item_id: 1,
            shopping_measure: null,
            shopping_measure_grams: null,
            zone: 'General',
            zone_seq: 0,
            department_name: 'Produce',
          },
        ],
      };
    }
    return { rows: [{ id: 1, name: 'Item', department: 1, department_name: 'Produce' }] };
  }
  if (s.includes('FROM items i') && s.includes('storezones sz') && s.includes('WHERE i.qty > 0')) {
    return { rows: [{ name: 'Milk', quantity: '1', department_id: 1, item_id: 1, zone: 'Aisle 1', zone_seq: 1, department_name: 'Produce' }] };
  }
  if (s.includes('INSERT INTO items') && s.includes('RETURNING *')) {
    return {
      rows: [
        {
          id: 1,
          name: params?.[0],
          department: params?.[1],
          qty: params?.[2] ?? 0,
        },
      ],
    };
  }
  if (s.includes('UPDATE items SET') && s.includes('kcal_qty') && s.includes('WHERE id = $11')) {
    return { rows: [{ id: params?.[10], name: params?.[0], department: params?.[1], qty: 0 }] };
  }
  if (s.includes('SELECT shopping_measure_grams FROM items WHERE')) {
    return { rows: [{ shopping_measure_grams: null }] };
  }
  // Shopping list: set qty by shopping units (PUT)
  if (s.includes('UPDATE items SET qty = CASE') && s.includes('shopping_measure_grams > 0')) {
    const nameParam = params?.[1];
    return {
      rows:
        nameParam === 'Nonexistent'
          ? []
          : [
              {
                id: 1,
                name: nameParam || 'Milk',
                department: 1,
                qty: params?.[0] ?? 2,
                shopping_measure: null,
                shopping_measure_grams: null,
              },
            ],
    };
  }
  // Shopping list: PATCH purchased / unpurchase
  if (s.includes('WHEN $1::boolean THEN 0') && s.includes('shopping_measure_grams')) {
    const nameParam = params?.[1];
    const purchased = params?.[0];
    return {
      rows:
        nameParam === 'Nonexistent'
          ? []
          : [
              {
                id: 1,
                name: nameParam || 'Milk',
                department: 1,
                qty: purchased ? 0 : 1,
                shopping_measure: null,
                shopping_measure_grams: null,
              },
            ],
    };
  }
  // Shopping list: increment qty (POST add)
  if (s.includes('UPDATE items SET qty = COALESCE(qty, 0) + $1')) {
    const name = params?.[1]; // name or id; when by name params are [addQty, name]
    return { rows: [{ id: 1, name: typeof name === 'string' ? name : 'Milk', department: 1, qty: params?.[0] ?? 1 }] };
  }
  if (s.includes('INSERT INTO mealplanner.meals (meal_date, meal_slot_id, recipe_id)')) {
    return { rows: [{ id: 1, meal_date: new Date().toISOString(), meal_slot_id: 4, recipe_id: params?.[0] ?? 1 }] };
  }
  if (s.includes('DELETE FROM mealplanner.meals WHERE recipe_id = $1')) {
    return { rows: [] };
  }
  // Shopping list: set qty (legacy direct grams), DELETE remove
  if (s.includes('UPDATE items SET qty = $1 WHERE name = $2') || s.includes('UPDATE items SET qty = 0 WHERE name = $1')) {
    const nameParam = s.includes('WHERE name = $2') ? params?.[1] : params?.[0];
    const qtyParam = s.includes('WHERE name = $2') ? params?.[0] : 0;
    return { rows: nameParam === 'Nonexistent' ? [] : [{ id: 1, name: nameParam || 'Milk', department: 1, qty: qtyParam }] };
  }
  if (s.includes('DELETE FROM items')) return { rows: [{ id: params?.[0] }] };
  // Legacy shopping_list mocks removed (shopping list now uses items table)
  // DELETE store zone: must return at least one row for 200
  if (s.includes('DELETE FROM storezones') && s.includes('RETURNING *')) return { rows: [{ storeid: 1, zonesequence: 1, departmentid: 1 }] };
  if (s.includes('UPDATE storezones SET zonesequence')) return { rows: [] };
  return { rows: [] };
}

function asyncQueryHandler(sql, params) {
  return Promise.resolve(defaultQueryHandler(sql, params));
}

// Single shared pool so tests can override query and affect the server. Use async handler so pg's await works.
const mockPool = createMockPool(asyncQueryHandler);

// Mock DB before server is loaded
jest.mock('../../common/database/db-config', () => ({
  createDbPool: () => mockPool,
  testConnection: () => {},
}));

describe('KitchenHub API', () => {
  let server;
  let serverModule;

  beforeAll(() => {
    serverModule = require('./server');
    server = serverModule.startServer(0);
  });

  afterAll((done) => {
    server.close(done);
  });

  describe('GET /api/health', () => {
    it('returns 200 with status, timestamp, and version', async () => {
      const res = await request(serverModule.app).get('/api/health');
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        status: 'ready',
        version: expect.any(String),
      });
      expect(res.body.timestamp).toBeDefined();
      expect(new Date(res.body.timestamp).toISOString()).toBe(res.body.timestamp);
    });
  });

  describe('Stores', () => {
    it('GET /api/stores returns All store first then DB stores', async () => {
      const res = await request(serverModule.app).get('/api/stores');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body[0]).toMatchObject({ id: -1, name: 'All' });
      expect(res.body.length).toBeGreaterThanOrEqual(1);
    });

    it('GET /api/stores/:id returns All store for id -1', async () => {
      const res = await request(serverModule.app).get('/api/stores/-1');
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ id: -1, name: 'All' });
    });

    it('GET /api/stores/:id returns 404 when store not found', async () => {
      mockPool.query.mockImplementation((sql, params) => {
        if (sql && sql.includes('SELECT * FROM store WHERE id')) return Promise.resolve({ rows: [] });
        return Promise.resolve(defaultQueryHandler(sql, params));
      });
      const res = await request(serverModule.app).get('/api/stores/999');
      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Store not found');
    });

    it('GET /api/stores/:id returns store when found', async () => {
      mockPool.query.mockImplementation((sql, params) => {
        if (sql && sql.includes('SELECT * FROM store WHERE id') && params?.[0] == 1) return Promise.resolve({ rows: [{ id: 1, name: 'Store A', modified: null }] });
        return Promise.resolve(defaultQueryHandler(sql, params));
      });
      const res = await request(serverModule.app).get('/api/stores/1');
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ id: 1, name: 'Store A' });
    });

    it('POST /api/stores creates store', async () => {
      const res = await request(serverModule.app).post('/api/stores').send({ name: 'New Store' });
      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({ name: 'New Store' });
      expect(res.body.id).toBeDefined();
    });

    it('PUT /api/stores/-1 returns 403 for All store', async () => {
      const res = await request(serverModule.app).put('/api/stores/-1').send({ name: 'X' });
      expect(res.status).toBe(403);
      expect(res.body.error).toContain('All store');
    });

    it('DELETE /api/stores/-1 returns 403 for All store', async () => {
      const res = await request(serverModule.app).delete('/api/stores/-1');
      expect(res.status).toBe(403);
    });

    it('PUT /api/stores/:id returns 404 when store not found', async () => {
      mockPool.query.mockImplementation((sql, params) => {
        if (sql && sql.includes('UPDATE store SET')) return Promise.resolve({ rows: [] });
        return Promise.resolve(defaultQueryHandler(sql, params));
      });
      const res = await request(serverModule.app).put('/api/stores/999').send({ name: 'X' });
      expect(res.status).toBe(404);
    });

    it('DELETE /api/stores/:id returns 404 when store not found', async () => {
      mockPool.query.mockImplementation((sql, params) => {
        if (sql && sql.includes('DELETE FROM store')) return Promise.resolve({ rows: [] });
        return Promise.resolve(defaultQueryHandler(sql, params));
      });
      const res = await request(serverModule.app).delete('/api/stores/999');
      expect(res.status).toBe(404);
    });
  });

  describe('Store zones', () => {
    it('GET /api/stores/-1/zones returns synthetic General zones', async () => {
      const res = await request(serverModule.app).get('/api/stores/-1/zones');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.every((z) => z.zonename === 'General' || z.department_name)).toBe(true);
    });

    it('GET /api/stores/1/zones returns zones from DB', async () => {
      const res = await request(serverModule.app).get('/api/stores/1/zones');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    beforeEach(() => {
      mockPool.query.mockImplementation(asyncQueryHandler);
    });

    it('POST /api/stores/-1/zones returns 403 for All store', async () => {
      const res = await request(serverModule.app)
        .post('/api/stores/-1/zones')
        .send({ zonesequence: 1, zonename: 'X', departmentid: 1 });
      expect(res.status).toBe(403);
    });

    it('POST /api/stores/1/zones creates zone', async () => {
      mockPool.query.mockImplementationOnce((sql) =>
        Promise.resolve({
          rows: [{ storeid: 1, zonesequence: 1, zonename: 'Aisle 1', departmentid: 1 }],
        })
      );
      const res = await request(serverModule.app)
        .post('/api/stores/1/zones')
        .send({ zonesequence: 1, zonename: 'Aisle 1', departmentid: 1 });
      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({ storeid: 1, zonesequence: 1, departmentid: 1 });
    });

    it('POST /api/stores/1/zones returns 400 for invalid store id', async () => {
      const res = await request(serverModule.app)
        .post('/api/stores/0/zones')
        .send({ zonesequence: 1, zonename: 'X', departmentid: 1 });
      expect(res.status).toBe(400);
    });

    it('POST /api/stores/1/zones/swap returns 403 for All store', async () => {
      const res = await request(serverModule.app).post('/api/stores/-1/zones/swap').send({ seqA: 1, seqB: 2 });
      expect(res.status).toBe(403);
    });

    it('POST /api/stores/1/zones/swap returns 400 when seqA/seqB missing', async () => {
      const res = await request(serverModule.app).post('/api/stores/1/zones/swap').send({});
      expect(res.status).toBe(400);
    });

    it('POST /api/stores/1/zones/swap succeeds', async () => {
      const res = await request(serverModule.app).post('/api/stores/1/zones/swap').send({ seqA: 1, seqB: 2 });
      expect(res.status).toBe(200);
      expect(res.body.message).toContain('reordered');
    });

    it('DELETE /api/stores/-1/zones/1/1 returns 403 for All store', async () => {
      const res = await request(serverModule.app).delete('/api/stores/-1/zones/1/1');
      expect(res.status).toBe(403);
    });

    it('DELETE /api/stores/1/zones/1/1 deletes zone', async () => {
      const res = await request(serverModule.app).delete('/api/stores/1/zones/1/1');
      expect(res.status).toBe(200);
    });
  });

  describe('Departments', () => {
    it('GET /api/departments returns list', async () => {
      const res = await request(serverModule.app).get('/api/departments');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('POST /api/departments creates department', async () => {
      const res = await request(serverModule.app).post('/api/departments').send({ name: 'Dairy' });
      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({ name: 'Dairy', ingredient: false });
    });

    it('PATCH /api/departments/:id updates ingredient flag', async () => {
      const res = await request(serverModule.app).patch('/api/departments/1').send({ ingredient: true });
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ id: 1, ingredient: true });
    });
  });

  describe('Items', () => {
    it('GET /api/items returns list', async () => {
      const res = await request(serverModule.app).get('/api/items');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('GET /api/items/:id returns 404 when not found', async () => {
      mockPool.query.mockImplementation((sql, params) => {
        if (sql && sql.includes('WHERE i.id')) return Promise.resolve({ rows: [] });
        return Promise.resolve(defaultQueryHandler(sql, params));
      });
      const res = await request(serverModule.app).get('/api/items/999');
      expect(res.status).toBe(404);
    });

    it('GET /api/items/1 returns item', async () => {
      mockPool.query.mockImplementation((sql, params) => {
        if (sql && sql.includes('WHERE i.id') && params?.[0] == 1) return Promise.resolve({ rows: [{ id: 1, name: 'Milk', department: 1, department_name: 'Dairy' }] });
        return Promise.resolve(defaultQueryHandler(sql, params));
      });
      const res = await request(serverModule.app).get('/api/items/1');
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ id: 1, name: 'Milk' });
    });

    it('POST /api/items creates item', async () => {
      const res = await request(serverModule.app).post('/api/items').send({ name: 'Bread', department: 1, qty: 2 });
      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({ name: 'Bread', department: 1, qty: 2 });
    });

    it('PUT /api/items/:id returns 404 when not found', async () => {
      mockPool.query.mockImplementation((sql, params) => {
        if (sql && sql.includes('UPDATE items SET')) return Promise.resolve({ rows: [] });
        return Promise.resolve(defaultQueryHandler(sql, params));
      });
      const res = await request(serverModule.app).put('/api/items/999').send({ name: 'X', department: 1, qty: 0 });
      expect(res.status).toBe(404);
    });

    it('DELETE /api/items/:id returns 404 when not found', async () => {
      mockPool.query.mockImplementation((sql, params) => {
        if (sql && sql.includes('DELETE FROM items')) return Promise.resolve({ rows: [] });
        return Promise.resolve(defaultQueryHandler(sql, params));
      });
      const res = await request(serverModule.app).delete('/api/items/999');
      expect(res.status).toBe(404);
    });
  });

  describe('Shopping list', () => {
    it('GET /api/shopping-list/-1 returns list for All store', async () => {
      const res = await request(serverModule.app).get('/api/shopping-list/-1');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('GET /api/shopping-list/1 returns list for store', async () => {
      const res = await request(serverModule.app).get('/api/shopping-list/1');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('GET /api/shopping-list returns all items', async () => {
      const res = await request(serverModule.app).get('/api/shopping-list');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('POST /api/shopping-list adds item', async () => {
      const res = await request(serverModule.app)
        .post('/api/shopping-list')
        .send({ name: 'Milk', description: 'Milk', quantity: '1', department_id: 1, item_id: null });
      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({ name: 'Milk', purchased: 0 });
    });

    it('PUT /api/shopping-list/:name returns 400 when no fields to update', async () => {
      const res = await request(serverModule.app).put('/api/shopping-list/Milk').send({});
      expect(res.status).toBe(400);
    });

    it('PUT /api/shopping-list/:name updates quantity', async () => {
      const res = await request(serverModule.app).put('/api/shopping-list/Milk').send({ quantity: '2' });
      expect(res.status).toBe(200);
    });

    it('PUT /api/shopping-list/:name returns 404 when not found', async () => {
      mockPool.query.mockImplementation((sql, params) => {
        if (sql && sql.includes('UPDATE items SET qty = $1 WHERE name = $2') && params?.[1] === 'Nonexistent') return Promise.resolve({ rows: [] });
        return Promise.resolve(defaultQueryHandler(sql, params));
      });
      const res = await request(serverModule.app).put('/api/shopping-list/Nonexistent').send({ quantity: '1' });
      expect(res.status).toBe(404);
    });

    it('PATCH /api/shopping-list/:name/purchased updates purchased', async () => {
      const res = await request(serverModule.app).patch('/api/shopping-list/Milk/purchased').send({ purchased: true });
      expect(res.status).toBe(200);
    });

    it('PATCH /api/shopping-list/:name/purchased returns 404 when not found', async () => {
      mockPool.query.mockImplementation((sql, params) => {
        if (sql && sql.includes('UPDATE items SET qty = $1 WHERE name = $2') && params?.[1] === 'Nonexistent') return Promise.resolve({ rows: [] });
        return Promise.resolve(defaultQueryHandler(sql, params));
      });
      const res = await request(serverModule.app).patch('/api/shopping-list/Nonexistent/purchased').send({ purchased: true });
      expect(res.status).toBe(404);
    });

    it('DELETE /api/shopping-list/:name removes item', async () => {
      const res = await request(serverModule.app).delete('/api/shopping-list/Milk');
      expect(res.status).toBe(200);
      expect(res.body.message).toContain('removed');
    });

    it('DELETE /api/shopping-list/:name returns 404 when not found', async () => {
      mockPool.query.mockImplementation((sql, params) => {
        if (sql && sql.includes('UPDATE items SET qty = 0 WHERE name = $1') && params?.[0] === 'Nonexistent') return Promise.resolve({ rows: [] });
        return Promise.resolve(defaultQueryHandler(sql, params));
      });
      const res = await request(serverModule.app).delete('/api/shopping-list/Nonexistent');
      expect(res.status).toBe(404);
    });
  });

  describe('Recipes — add to shopping list', () => {
    beforeEach(() => {
      mockPool.query.mockImplementation(asyncQueryHandler);
    });

    it('POST /api/recipes/:id/shopping-list increments by qty × to_grams', async () => {
      const res = await request(serverModule.app).post('/api/recipes/1/shopping-list');
      expect(res.status).toBe(201);
      expect(res.body.added).toHaveLength(1);
      expect(res.body.added[0]).toMatchObject({
        item_id: 1,
        grams_added: 10,
        scale: 1,
      });
      expect(res.body.skipped).toEqual([]);
      expect(res.body.scale).toBe(1);
    });

    it('POST /api/recipes/:id/shopping-list scales ingredient quantities', async () => {
      const res = await request(serverModule.app).post('/api/recipes/1/shopping-list').send({ scale: 3 });
      expect(res.status).toBe(201);
      expect(res.body.added).toHaveLength(1);
      expect(res.body.added[0]).toMatchObject({
        item_id: 1,
        grams_added: 30,
        scale: 3,
      });
      expect(res.body.scale).toBe(3);
    });

    it('POST /api/recipes/:id/shopping-list returns 400 when scale is invalid', async () => {
      const res = await request(serverModule.app).post('/api/recipes/1/shopping-list').send({ scale: 1.5 });
      expect(res.status).toBe(400);
    });

    it('POST /api/recipes/:id/shopping-list returns 404 when recipe missing', async () => {
      const res = await request(serverModule.app).post('/api/recipes/999/shopping-list');
      expect(res.status).toBe(404);
    });
  });

  describe('Schedulable meal-planner filters', () => {
    beforeEach(() => {
      mockPool.query.mockImplementation(asyncQueryHandler);
    });

    it('GET /api/recipe-categories?schedulable=1 filters to schedulable categories', async () => {
      mockPool.query.mockImplementation((sql, params) => {
        const s = (sql || '').trim();
        if (s.includes('FROM recipe.recipe_category WHERE schedulable IS TRUE')) {
          return Promise.resolve({ rows: [{ id: 10, name: 'Dinner', schedulable: true }] });
        }
        return Promise.resolve(defaultQueryHandler(sql, params));
      });

      const res = await request(serverModule.app).get('/api/recipe-categories?schedulable=1');
      expect(res.status).toBe(200);
      expect(res.body).toEqual([{ id: 10, name: 'Dinner', schedulable: true }]);
    });

    it('GET /api/recipes?schedulable=1 includes schedulable recipe filter', async () => {
      mockPool.query.mockImplementation((sql, params) => {
        const s = (sql || '').trim();
        if (s.includes('FROM recipe.recipe r') && s.includes('r.schedulable IS TRUE')) {
          return Promise.resolve({ rows: [{ id: 11, name: 'Yummy Dish', servings: 2, instructions: 'Mix' }] });
        }
        return Promise.resolve(defaultQueryHandler(sql, params));
      });

      const res = await request(serverModule.app).get('/api/recipes?schedulable=1');
      expect(res.status).toBe(200);
      expect(res.body).toEqual([{ id: 11, name: 'Yummy Dish', servings: 2, instructions: 'Mix' }]);
    });
  });

  describe('Meal planner', () => {
    beforeEach(() => {
      mockPool.query.mockImplementation(asyncQueryHandler);
      mockPool.connect.mockResolvedValue({
        query: jest.fn().mockImplementation(asyncQueryHandler),
        release: jest.fn(),
      });
    });

    it('GET /api/meal-planner returns slot kcal and meal kcal/leftover metadata', async () => {
      mockPool.query.mockImplementation((sql, params) => {
        const s = (sql || '').trim();
        if (s.includes("table_schema = 'mealplanner' AND table_name = 'meal_slot'")) {
          return Promise.resolve({ rows: [{ column_name: 'seq' }, { column_name: 'servings' }, { column_name: 'kcal' }] });
        }
        if (s.includes('FROM mealplanner.meal_slot')) {
          return Promise.resolve({ rows: [{ id: 2, name: 'Lunch', seq: 2, servings: 2, kcal: 550 }] });
        }
        if (s.includes("table_schema = 'mealplanner' AND table_name = 'meals'")) {
          return Promise.resolve({
            rows: [
              { column_name: 'id' },
              { column_name: 'meal_slot_id' },
              { column_name: 'servings' },
              { column_name: 'leftover_from_meal_id' },
              { column_name: 'leftover_servings' },
            ],
          });
        }
        if (s.includes('FROM mealplanner.meals m') && s.includes('JOIN recipe.recipe r')) {
          return Promise.resolve({
            rows: [
              {
                meal_id: 7,
                meal_day: '2026-04-27',
                meal_slot_id: 2,
                recipe_id: 11,
                recipe_name: 'Yummy Dish',
                recipe_servings: 2,
                meal_servings: 2,
                leftover_from_meal_id: 6,
                leftover_servings: '2',
              },
              {
                meal_id: 6,
                meal_day: '2026-04-26',
                meal_slot_id: 4,
                recipe_id: 11,
                recipe_name: 'Yummy Dish',
                recipe_servings: 2,
                meal_servings: 8,
                leftover_from_meal_id: null,
                leftover_servings: null,
              },
            ],
          });
        }
        if (s.includes('FROM recipe.recipe_ingredients ri')) {
          return Promise.resolve({
            rows: [
              {
                recipe_id: 11,
                qty: 100,
                measurement_name: 'Gram',
                to_grams: 1,
                kcal: 200,
                kcal_qty: 100,
                kcal_measurement_name: 'Gram',
                kcal_to_grams: 1,
                ingredient_unit_grams: null,
                shopping_measure_grams: null,
                recipe_servings: 2,
              },
            ],
          });
        }
        return Promise.resolve(defaultQueryHandler(sql, params));
      });

      const res = await request(serverModule.app).get('/api/meal-planner?start=2026-04-27');
      expect(res.status).toBe(200);
      expect(res.body.days[0].slots[0].kcal).toBe(550);
      expect(res.body.days[0].slots[0].meal.kcal_per_serving).toBe(100);
      expect(res.body.days[0].slots[0].meal.leftover_from_meal_id).toBe(6);
    });

    it('PATCH /api/meal-planner/slot-kcal updates slot kcal', async () => {
      mockPool.query.mockImplementation((sql, params) => {
        const s = (sql || '').trim();
        if (s.includes("table_schema = 'mealplanner' AND table_name = 'meal_slot'")) {
          return Promise.resolve({ rows: [{ column_name: 'kcal' }] });
        }
        if (s.includes('UPDATE mealplanner.meal_slot')) {
          return Promise.resolve({ rows: [{ id: params[0], kcal: params[1] }] });
        }
        return Promise.resolve(defaultQueryHandler(sql, params));
      });
      const res = await request(serverModule.app)
        .patch('/api/meal-planner/slot-kcal')
        .send({ meal_slot_id: 2, kcal: 600 });
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ meal_slot_id: 2, kcal: 600 });
    });

    it('POST /api/meal-planner/leftovers/auto-link defaults to next lunch slot', async () => {
      const clientQuery = jest.fn().mockImplementation((sql, params) => {
        const s = (sql || '').trim();
        if (s === 'BEGIN' || s === 'COMMIT' || s === 'ROLLBACK') return Promise.resolve({ rows: [] });
        if (s.includes("table_schema = 'mealplanner' AND table_name = 'meals'")) {
          return Promise.resolve({
            rows: [
              { column_name: 'id' },
              { column_name: 'meal_slot_id' },
              { column_name: 'servings' },
              { column_name: 'leftover_from_meal_id' },
              { column_name: 'leftover_servings' },
            ],
          });
        }
        if (s.includes('FROM mealplanner.meals m') && s.includes('JOIN mealplanner.meal_slot ms')) {
          return Promise.resolve({ rows: [{ id: 10, recipe_id: 11, servings: 8, slot_servings: 4 }] });
        }
        if (s.includes("WHERE lower(name) = 'lunch'")) {
          return Promise.resolve({ rows: [{ id: 2, servings: 2 }] });
        }
        if (s.includes('SELECT id') && s.includes('WHERE meal_date::date = $1::date AND meal_slot_id = $2')) {
          return Promise.resolve({ rows: [] });
        }
        if (s.includes('INSERT INTO mealplanner.meals (meal_date, meal_slot_id, recipe_id, servings, leftover_from_meal_id, leftover_servings)')) {
          return Promise.resolve({ rows: [{ id: 101 }] });
        }
        return Promise.resolve(defaultQueryHandler(sql, params));
      });
      mockPool.connect.mockResolvedValue({ query: clientQuery, release: jest.fn() });

      const res = await request(serverModule.app)
        .post('/api/meal-planner/leftovers/auto-link')
        .send({ source_meal_date: '2026-04-27', source_meal_slot_id: 4 });
      expect(res.status).toBe(200);
      expect(res.body.linked.length).toBeGreaterThan(0);
      expect(res.body.leftover_servings_remaining).toBe(0);
    });
  });

  describe('Error handling', () => {
    it('GET /api/stores returns 500 on DB error', async () => {
      mockPool.query.mockRejectedValueOnce(new Error('DB down'));
      const res = await request(serverModule.app).get('/api/stores');
      expect(res.status).toBe(500);
      expect(res.body.error).toContain('fetch stores');
    });
  });
});
