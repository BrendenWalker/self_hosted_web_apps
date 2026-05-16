/**
 * Load KitchenHub DB env and create a pg Pool (backend node_modules).
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const KITCHENHUB_ROOT = path.resolve(__dirname, '../..');
const REPO_ROOT = path.resolve(KITCHENHUB_ROOT, '..');
const BACKEND_PKG = path.join(KITCHENHUB_ROOT, 'backend', 'package.json');

export function loadKitchenhubEnv() {
  const req = createRequire(BACKEND_PKG);
  let dotenv;
  try {
    dotenv = req('dotenv');
  } catch {
    return;
  }
  for (const envPath of [
    path.join(KITCHENHUB_ROOT, 'backend', '.env'),
    path.join(REPO_ROOT, '.env'),
    path.join(KITCHENHUB_ROOT, '.env'),
  ]) {
    if (fs.existsSync(envPath)) {
      dotenv.config({ path: envPath });
    }
  }
}

export function loadPg() {
  const req = createRequire(BACKEND_PKG);
  return req('pg');
}

/**
 * @returns {import('pg').Pool}
 */
export function createPool() {
  loadKitchenhubEnv();
  const { Pool } = loadPg();
  return new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 5432,
    database: process.env.DB_NAME,
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    connectionTimeoutMillis: 10000,
  });
}
