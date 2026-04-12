import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';

dotenv.config();

/**
 * PostgreSQL Connection Pool
 * Handles connections to the "AI-Native Language" database.
 */
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  // We can also have fallback settings if DATABASE_URL is missing
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

pool.on('error', (err) => {
  console.error('[Database Pool] Unexpected error:', err);
});

export const query = (text, params) => pool.query(text, params);

export default pool;
