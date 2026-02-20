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
  if (s.includes('SELECT * FROM common.department')) return { rows: [{ id: 1, name: 'Produce' }] };
  if (s.includes('INSERT INTO common.department')) return { rows: [{ id: 2, name: params?.[0] || 'New' }] };
  if (s.includes('FROM items i') && s.includes('LEFT JOIN common.department')) {
    if (s.includes('WHERE i.id')) return { rows: params?.[0] == 1 ? [{ id: 1, name: 'Item', department: 1, department_name: 'Produce' }] : [] };
    return { rows: [{ id: 1, name: 'Item', department: 1, department_name: 'Produce' }] };
  }
  if (s.includes('INSERT INTO items')) return { rows: [{ id: 1, name: params?.[0], department: params?.[1], qty: params?.[2] ?? 0 }] };
  if (s.includes('UPDATE items SET')) return { rows: [{ id: params?.[3], name: params?.[0], department: params?.[1], qty: params?.[2] }] };
  if (s.includes('DELETE FROM items')) return { rows: [{ id: params?.[0] }] };
  if (s.includes('FROM shopping_list sl') && s.includes('LEFT JOIN common.department')) return { rows: [] };
  if (s.includes('FROM shopping_list sl') && s.includes('LEFT JOIN items')) return { rows: [] };
  if (s.includes('INSERT INTO shopping_list') || s.includes('ON CONFLICT (name)')) return { rows: [{ name: params?.[0], description: null, quantity: '1', department_id: null, item_id: null, purchased: 0 }] };
  if (s.includes('UPDATE shopping_list SET') && s.includes('quantity')) return { rows: [{ name: params?.[params.length - 1], quantity: params?.[0], purchased: 0 }] };
  if (s.includes('UPDATE shopping_list SET purchased')) return { rows: [{ name: params?.[1], purchased: params?.[0] }] };
  if (s.includes('DELETE FROM shopping_list WHERE name')) return { rows: [{ name: params?.[0] }] };
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
      expect(res.body).toMatchObject({ name: 'Dairy' });
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
      const res = await request(serverModule.app).put('/api/items/999').send({ name: 'X', department: null, qty: 0 });
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
        if (sql && sql.includes('UPDATE shopping_list SET') && sql.includes('quantity')) return Promise.resolve({ rows: [] });
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
        if (sql && sql.includes('UPDATE shopping_list SET purchased')) return Promise.resolve({ rows: [] });
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
        if (sql && sql.includes('DELETE FROM shopping_list WHERE name')) return Promise.resolve({ rows: [] });
        return Promise.resolve(defaultQueryHandler(sql, params));
      });
      const res = await request(serverModule.app).delete('/api/shopping-list/Nonexistent');
      expect(res.status).toBe(404);
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
