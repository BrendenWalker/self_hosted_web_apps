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
  const config = {
    host: options.host || process.env.DB_HOST || 'localhost',
    port: options.port || process.env.DB_PORT || 5432,
    database: options.database || process.env.DB_NAME,
    user: options.user || process.env.DB_USER || 'postgres',
    password: options.password || process.env.DB_PASSWORD || 'postgres',
    max: options.max || 20,
    idleTimeoutMillis: options.idleTimeoutMillis || 30000,
    connectionTimeoutMillis: options.connectionTimeoutMillis || 10000, // Increased from 2000ms to 10000ms
  };
  
  // Log connection details (without password) for debugging
  console.log('Database connection config:', {
    host: config.host,
    port: config.port,
    database: config.database,
    user: config.user,
    connectionTimeoutMillis: config.connectionTimeoutMillis,
  });
  
  return new Pool(config);
}

/**
 * Tests database connection (non-blocking)
 * @param {Pool} pool - Database connection pool
 */
function testConnection(pool) {
  pool.query('SELECT NOW()', (err, res) => {
    if (err) {
      console.error('Database connection error:', err.message);
      console.error('Error code:', err.code);
      console.error('Error details:', {
        host: err.address,
        port: err.port,
        database: pool.options?.database,
      });
    } else {
      console.log('Database connected successfully');
      console.log('Database time:', res.rows[0].now);
    }
  });
}

module.exports = {
  createDbPool,
  testConnection,
};
