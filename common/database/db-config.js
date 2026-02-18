/**
 * Shared database configuration for all hub services
 * This module provides a reusable PostgreSQL connection pool
 */

const { Pool } = require('pg');
require('dotenv').config();

/**
 * Creates a PostgreSQL connection pool with standard configuration
 * @param {Object} options - Optional overrides for default config
 * @returns {Pool} PostgreSQL connection pool
 */
function createDbPool(options = {}) {
  return new Pool({
    host: options.host || process.env.DB_HOST || 'localhost',
    port: options.port || process.env.DB_PORT || 5432,
    database: options.database || process.env.DB_NAME,
    user: options.user || process.env.DB_USER || 'postgres',
    password: options.password || process.env.DB_PASSWORD || 'postgres',
    max: options.max || 20,
    idleTimeoutMillis: options.idleTimeoutMillis || 30000,
    connectionTimeoutMillis: options.connectionTimeoutMillis || 2000,
  });
}

/**
 * Tests database connection (non-blocking)
 * @param {Pool} pool - Database connection pool
 */
function testConnection(pool) {
  pool.query('SELECT NOW()', (err, res) => {
    if (err) {
      console.error('Database connection error:', err);
    } else {
      console.log('Database connected successfully');
    }
  });
}

module.exports = {
  createDbPool,
  testConnection,
};
