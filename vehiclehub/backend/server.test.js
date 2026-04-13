/**
 * VehicleHub backend API tests (DB mocked; no PostgreSQL required).
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

function defaultQueryHandler(sql, params) {
  const s = (sql || '').trim();
  if (s.includes('SELECT * FROM vehicle ORDER BY name')) {
    return { rows: [{ id: 1, name: 'Test Vehicle' }] };
  }
  if (s.includes('SELECT * FROM vehicle WHERE id')) {
    const id = params?.[0];
    return id == 1 || id === '1'
      ? { rows: [{ id: 1, name: 'Test Vehicle' }] }
      : { rows: [] };
  }
  if (s.includes('INSERT INTO vehicle') && s.includes('RETURNING')) {
    return { rows: [{ id: 2, name: params?.[0] }] };
  }
  if (s.includes('UPDATE vehicle SET') && s.includes('RETURNING')) {
    return { rows: [{ id: Number(params?.[1]), name: params?.[0] }] };
  }
  if (s.includes('DELETE FROM vehicle') && s.includes('RETURNING')) {
    return { rows: [{ id: params?.[0] }] };
  }
  if (s.includes('FROM servicetype ORDER BY name')) {
    return { rows: [{ id: 1, name: 'Oil Change' }] };
  }
  if (s.includes('SELECT * FROM servicetype WHERE id')) {
    return params?.[0] == 1 ? { rows: [{ id: 1, name: 'Oil Change' }] } : { rows: [] };
  }
  return { rows: [] };
}

function asyncQueryHandler(sql, params) {
  return Promise.resolve(defaultQueryHandler(sql, params));
}

const mockPool = createMockPool(asyncQueryHandler);

jest.mock('../../common/database/db-config', () => ({
  createDbPool: () => mockPool,
  testConnection: () => {},
}));

describe('VehicleHub API', () => {
  let server;
  let serverModule;

  beforeAll(() => {
    serverModule = require('./server');
    server = serverModule.startServer(0);
  });

  afterAll((done) => {
    server.close(done);
  });

  beforeEach(() => {
    mockPool.query.mockImplementation(asyncQueryHandler);
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

  describe('Vehicles', () => {
    it('GET /api/vehicles returns list', async () => {
      const res = await request(serverModule.app).get('/api/vehicles');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body[0]).toMatchObject({ id: 1, name: 'Test Vehicle' });
    });

    it('GET /api/vehicles returns 503 when vehicle table is missing', async () => {
      const err = Object.assign(new Error('relation "vehicle" does not exist'), { code: '42P01' });
      mockPool.query.mockRejectedValueOnce(err);
      const res = await request(serverModule.app).get('/api/vehicles');
      expect(res.status).toBe(503);
      expect(res.body.error).toMatch(/schema\.sql/i);
    });

    it('GET /api/vehicles/:id returns 404 when not found', async () => {
      const res = await request(serverModule.app).get('/api/vehicles/999');
      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Vehicle not found');
    });

    it('GET /api/vehicles/:id returns vehicle when found', async () => {
      const res = await request(serverModule.app).get('/api/vehicles/1');
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ id: 1, name: 'Test Vehicle' });
    });

    it('POST /api/vehicles creates vehicle', async () => {
      const res = await request(serverModule.app).post('/api/vehicles').send({ name: 'New Car' });
      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({ name: 'New Car', id: 2 });
    });

    it('PUT /api/vehicles/:id returns 404 when not found', async () => {
      mockPool.query.mockImplementation((sql, p) => {
        if (sql && sql.includes('UPDATE vehicle SET')) return Promise.resolve({ rows: [] });
        return Promise.resolve(defaultQueryHandler(sql, p));
      });
      const res = await request(serverModule.app).put('/api/vehicles/999').send({ name: 'X' });
      expect(res.status).toBe(404);
    });
  });

  describe('Service types', () => {
    it('GET /api/service-types returns list', async () => {
      const res = await request(serverModule.app).get('/api/service-types');
      expect(res.status).toBe(200);
      expect(res.body).toEqual([{ id: 1, name: 'Oil Change' }]);
    });
  });
});
