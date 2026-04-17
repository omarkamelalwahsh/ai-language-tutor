import pool from '../server/db.js';

async function inspectDatabase() {
  console.log('🔍 Connecting to PostgreSQL...');
  
  try {
    // 1. Check if we can connect to the server at all
    const testRes = await pool.query('SELECT NOW()');
    console.log(`✅ Connected successfully! Server time: ${testRes.rows[0].now}`);

    // 2. Get all tables in the public schema
    const tablesRes = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
    `);
    
    const tables = tablesRes.rows;
    
    if (tables.length === 0) {
      console.log('❌ No tables found in the public schema. Are you sure you are in the right database?');
      process.exit(0);
    }
    
    console.log(`✅ Found ${tables.length} tables: ${tables.map(t => t.table_name).join(', ')}\n`);
    
    for (const table of tables) {
      const tableName = table.table_name;
      console.log(`--- Table: ${tableName} ---`);
      
      // 3. Get all columns for each table
      const columnsRes = await pool.query(`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns 
        WHERE table_name = $1 
        ORDER BY ordinal_position
      `, [tableName]);
      
      columnsRes.rows.forEach(col => {
        const nullable = col.is_nullable === 'YES' ? '' : ' (NOT NULL)';
        const def = col.column_default ? ` DEFAULT ${col.column_default}` : '';
        console.log(`  - ${col.column_name} (${col.data_type})${nullable}${def}`);
      });
      console.log('');
    }
    
  } catch (err) {
    console.error('❌ Error inspecting database:', err.message);
    console.error(`   Host: ${process.env.DB_HOST}`);
    console.error(`   Port: ${process.env.DB_PORT}`);
    console.error(`   User: ${process.env.DB_USER}`);
    console.error(`   DB:   ${process.env.DB_NAME}`);
  } finally {
    await pool.end();
  }
}

inspectDatabase();
