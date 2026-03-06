/**
 * RetirementHub backend API tests
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

/** Default mock: return empty rows for most SELECTs, one row for UPDATE RETURNING. */
function defaultQueryHandler(sql, params) {
  const s = (sql || '').trim();
  if (s.includes('SELECT * FROM household ORDER BY id LIMIT 1')) {
    return {
      rows: [
        {
          id: 1,
          p1_display_name: 'P1',
          p2_display_name: 'P2',
          p1_birth_year: 1960,
          p2_birth_year: 1962,
          p1_retirement_date: '2025-01-01',
          p2_retirement_date: '2027-06-01',
          p1_ss_monthly_estimate: 2000,
          p2_ss_monthly_estimate: 1500,
          p1_ss_at_fra: 2200,
          p2_ss_at_fra: 1800,
          filing_status: 'married',
          modified: null,
        },
      ],
    };
  }
  if (s.includes('UPDATE household SET') && s.includes('RETURNING *')) {
    return {
      rows: [
        {
          id: 1,
          p1_display_name: params?.[0] ?? 'P1',
          p2_display_name: params?.[1] ?? 'P2',
          p1_birth_year: params?.[2] ?? 1960,
          p2_birth_year: params?.[3] ?? 1962,
          p1_retirement_date: params?.[4] ?? '2025-01-01',
          p2_retirement_date: params?.[5] ?? '2027-06-01',
          p1_ss_monthly_estimate: params?.[6] ?? 2000,
          p2_ss_monthly_estimate: params?.[7] ?? 1500,
          p1_ss_at_fra: params?.[8] ?? 2200,
          p2_ss_at_fra: params?.[9] ?? 1800,
          filing_status: params?.[10] ?? 'married',
          modified: null,
        },
      ],
    };
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

describe('RetirementHub API', () => {
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

  describe('Household', () => {
    it('GET /api/household returns household when found', async () => {
      const res = await request(serverModule.app).get('/api/household');
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        id: 1,
        p1_display_name: 'P1',
        p2_display_name: 'P2',
        filing_status: 'married',
      });
    });

    it('GET /api/household returns 404 when not found', async () => {
      mockPool.query.mockImplementation((sql) => {
        if (sql && sql.includes('SELECT * FROM household ORDER BY id LIMIT 1')) {
          return Promise.resolve({ rows: [] });
        }
        return Promise.resolve(defaultQueryHandler(sql));
      });
      const res = await request(serverModule.app).get('/api/household');
      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Household not found');
    });

    it('PUT /api/household updates household', async () => {
      mockPool.query.mockImplementation(asyncQueryHandler);
      const res = await request(serverModule.app)
        .put('/api/household')
        .send({ p1_display_name: 'Alice', filing_status: 'married' });
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ p1_display_name: 'Alice', filing_status: 'married' });
    });

    it('PUT /api/household returns 404 when not found', async () => {
      mockPool.query.mockImplementation((sql) => {
        if (sql && sql.includes('UPDATE household SET')) {
          return Promise.resolve({ rows: [] });
        }
        return Promise.resolve(defaultQueryHandler(sql));
      });
      const res = await request(serverModule.app)
        .put('/api/household')
        .send({ p1_display_name: 'X' });
      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Household not found');
    });
  });

  describe('Error handling', () => {
    it('GET /api/household returns 500 on DB error', async () => {
      mockPool.query.mockRejectedValueOnce(new Error('DB down'));
      const res = await request(serverModule.app).get('/api/household');
      expect(res.status).toBe(500);
      expect(res.body.error).toBeDefined();
    });
  });
});
