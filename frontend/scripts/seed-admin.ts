import bcrypt from 'bcryptjs';
import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function seedAdmin() {
  const name = 'Admin User';
  const email = 'admin@example.com';
  const password = 'adminpassword123';

  try {
    const password_hash = await bcrypt.hash(password, 10);
    
    // Check if exists
    const exists = await pool.query('SELECT 1 FROM users WHERE email = $1', [email]);
    if (exists.rowCount > 0) {
      console.log('✅ Admin user already exists (admin@example.com)');
      process.exit(0);
    }

    await pool.query(
      "INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, 'admin')",
      [name, email, password_hash]
    );

    console.log('🚀 Admin user created successfully!');
    console.log('📧 Email: admin@example.com');
    console.log('🔑 Password: adminpassword123');
    
  } catch (err) {
    console.error('❌ Failed to seed admin:', err);
  } finally {
    await pool.end();
  }
}

seedAdmin();
