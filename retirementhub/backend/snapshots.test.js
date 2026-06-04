/**
 * Endpoint snapshot regression tests — lock tax/projection API output.
 */
const request = require('supertest');
const { snapshotQueryHandler } = require('./testFixtures/snapshotFixtures');

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

function asyncSnapshotHandler(sql, params) {
  return Promise.resolve(snapshotQueryHandler(sql, params));
}

const mockPool = createMockPool(asyncSnapshotHandler);

jest.mock('../../common/database/db-config', () => ({
  createDbPool: () => mockPool,
  testConnection: () => {},
}));

describe('Endpoint snapshots (regression guard)', () => {
  let server;
  let serverModule;

  beforeAll(() => {
    jest.useFakeTimers({ now: new Date('2026-06-04T12:00:00Z') });
    serverModule = require('./server');
    server = serverModule.startServer(0);
  });

  afterAll((done) => {
    jest.useRealTimers();
    server.close(done);
  });

  test('GET /api/savings-limits matches snapshot', async () => {
    const res = await request(serverModule.app).get('/api/savings-limits');
    expect(res.status).toBe(200);
    expect(res.body).toMatchSnapshot();
  });

  test('GET /api/retirement-tax-guide?year=2026&taxable_income=120000 matches snapshot', async () => {
    const res = await request(serverModule.app).get(
      '/api/retirement-tax-guide?year=2026&taxable_income=120000'
    );
    expect(res.status).toBe(200);
    expect(res.body).toMatchSnapshot();
  });

  test('GET /api/projections matches snapshot', async () => {
    const res = await request(serverModule.app).get('/api/projections');
    expect(res.status).toBe(200);
    expect(res.body).toMatchSnapshot();
  });
});
