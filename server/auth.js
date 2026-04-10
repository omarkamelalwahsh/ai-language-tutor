import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { supabase } from './supabaseClient.js';

export const authRouter = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key-change-me';

// 1. Trainee Signup
authRouter.post('/trainee/signup', async (req, res) => {
  const { name, email, password } = req.body;

  if (!email || !password || !name) {
    return res.status(400).json({ error: 'Name, email, and password are required' });
  }

  try {
    // Check if user exists
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('email', email)
      .single();

    if (existingUser) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    // Hash password
    const password_hash = await bcrypt.hash(password, 10);

    // Create User (Manual insert for public.users if still using that, 
    // but the trigger on auth.users is the main one now)
    const { data: user, error: userError } = await supabase
      .from('users')
      .insert([{ name, email, password_hash, role: 'user' }])
      .select()
      .single();

    if (userError) throw userError;

    // Note: learner_profile and skill_states are now created automatically
    // via PostgreSQL trigger [on_auth_user_created] in the database.

    // Generate token
    const token = jwt.sign({ id: user.id, role: user.role, email: user.email }, JWT_SECRET, { expiresIn: '7d' });

    res.status(201).json({
      message: 'Signup successful',
      token,
      user: { ...user, onboarding_complete: false }
    });
  } catch (err) {
    console.error('[Signup Error]', err);
    res.status(500).json({ error: 'Internal server error during signup' });
  }
});

// 2. Trainee Login
authRouter.post('/trainee/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .eq('role', 'user')
      .single();

    if (error || !user) {
      return res.status(401).json({ error: 'Invalid credentials or role' });
    }

    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign({ id: user.id, role: user.role, email: user.email }, JWT_SECRET, { expiresIn: '7d' });

    const { data: profile } = await supabase
      .from('learner_profiles')
      .select('onboarding_complete')
      .eq('id', user.id)
      .single();

    const onboarding_complete = profile?.onboarding_complete || false;

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

// 3. Onboarding Completion
authRouter.post('/onboarding/complete', async (req, res) => {
  const { userId, cefrLevel, interests } = req.body;

  try {
    const { data, error } = await supabase
      .from('learner_profiles')
      .update({
        onboarding_complete: true,
        overall_level: cefrLevel
      })
      .eq('id', userId);

    if (error) throw error;

    return res.status(200).json({ message: 'Onboarding finished successfully!' });
  } catch (err) {
    console.error('[Onboarding Error]', err);
    return res.status(500).json({ error: err.message });
  }
});

// 4. Admin Login
authRouter.post('/admin/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .eq('role', 'admin')
      .single();

    if (error || !user) {
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
