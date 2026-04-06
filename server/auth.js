import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pool from './db.js';

export const authRouter = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key-change-me';

// Utility to create tables if they don't exist
async function ensureAuthTables() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      role VARCHAR(50) NOT NULL CHECK (role IN ('user', 'admin')),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS learner_profiles (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID REFERENCES users(id) ON DELETE CASCADE,
      overall_band VARCHAR(10) DEFAULT 'A1',
      total_time_spent INTEGER DEFAULT 0,
      assessments_completed INTEGER DEFAULT 0,
      onboarding_complete BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS skill_states (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID REFERENCES users(id) ON DELETE CASCADE,
      skill VARCHAR(50) NOT NULL,
      estimated_cefr VARCHAR(10) DEFAULT 'A1',
      score FLOAT DEFAULT 0,
      confidence FLOAT DEFAULT 0,
      evidence_count INTEGER DEFAULT 0,
      direct_evidence_count INTEGER DEFAULT 0,
      indirect_evidence_count INTEGER DEFAULT 0,
      consistency FLOAT DEFAULT 0,
      status VARCHAR(50) DEFAULT 'insufficient_data',
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, skill)
    );
  `);
}

// Call it on startup
ensureAuthTables().catch(console.error);

// 1. Trainee Signup
authRouter.post('/trainee/signup', async (req, res) => {
  const { name, email, password } = req.body;

  if (!email || !password || !name) {
    return res.status(400).json({ error: 'Name, email, and password are required' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN'); // Start transaction

    // Check if user exists
    const userExists = await client.query('SELECT 1 FROM users WHERE email = $1', [email]);
    if (userExists.rowCount > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Email already registered' });
    }

    // Hash password
    const password_hash = await bcrypt.hash(password, 10);

    // Create User
    const userRes = await client.query(
      `INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, 'user') RETURNING id, name, email, role`,
      [name, email, password_hash]
    );
    const user = userRes.rows[0];

    // Create Learner Profile
    await client.query(
      'INSERT INTO learner_profiles (user_id) VALUES ($1)',
      [user.id]
    );

    // Create Skill States
    const skills = ['listening', 'reading', 'writing', 'speaking', 'grammar', 'vocabulary'];
    const skillQueries = skills.map(skill => {
      return client.query(
        'INSERT INTO skill_states (user_id, skill) VALUES ($1, $2)',
        [user.id, skill]
      );
    });
    await Promise.all(skillQueries);

    await client.query('COMMIT'); // Commit transaction

    // Generate token
    const token = jwt.sign({ id: user.id, role: user.role, email: user.email }, JWT_SECRET, { expiresIn: '7d' });

    res.status(201).json({ 
      message: 'Signup successful', 
      token, 
      user: { ...user, onboarding_complete: false } 
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[Signup Error]', err);
    res.status(500).json({ error: 'Internal server error during signup' });
  } finally {
    client.release();
  }
});

// 2. Trainee Login
authRouter.post('/trainee/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    const userRes = await pool.query('SELECT * FROM users WHERE email = $1 AND role = $2', [email, 'user']);
    const user = userRes.rows[0];

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials or role' });
    }

    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign({ id: user.id, role: user.role, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
    
    const profileRes = await pool.query('SELECT onboarding_complete FROM learner_profiles WHERE user_id = $1', [user.id]);
    const onboarding_complete = profileRes.rows[0]?.onboarding_complete || false;

    res.json({ 
      message: 'Login successful', 
      token, 
      user: { 
        id: user.id, 
        name: user.name, 
        email: user.email, 
        role: user.role,
        onboarding_complete
      } 
    });
  } catch (err) {
    console.error('[Login Error]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 3. Admin Login
authRouter.post('/admin/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    const userRes = await pool.query('SELECT * FROM users WHERE email = $1 AND role = $2', [email, 'admin']);
    const user = userRes.rows[0];

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials or role' });
    }

    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign({ id: user.id, role: user.role, email: user.email }, JWT_SECRET, { expiresIn: '1d' });
    res.json({ message: 'Admin login successful', token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
  } catch (err) {
    console.error('[Admin Login Error]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});
