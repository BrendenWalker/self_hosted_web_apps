/**
 * KitchenHub backend API tests
 * Run with: npm test
 *
 * Database is mocked so tests run without PostgreSQL.
 */

const request = require('supertest');

// Mock DB before server is loaded so createDbPool returns a fake pool
jest.mock('../../common/database/db-config', () => ({
  createDbPool: () => ({
    query: jest.fn().mockResolvedValue({ rows: [] }),
  }),
  testConnection: () => {},
}));

describe('KitchenHub API', () => {
  let server;
  let serverModule;

  beforeAll(() => {
    serverModule = require('./server');
    server = serverModule.startServer(0); // start so isReady becomes true
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
});
