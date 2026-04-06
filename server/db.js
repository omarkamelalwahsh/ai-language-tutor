import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';

dotenv.config();

/**
 * PostgreSQL Connection Pool
 * Handles connections to the "AI-Native Language" database.
 */
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '12345678',
  database: process.env.DB_NAME || 'AI-Native Language',
  // Database names with spaces are handled by the driver if passed as a string
});

pool.on('error', (err) => {
  console.error('[Database Pool] Unexpected error:', err);
});

export const query = (text, params) => pool.query(text, params);

export default pool;
