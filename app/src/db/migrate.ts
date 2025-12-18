import * as fs from 'fs';
import * as path from 'path';
import { pool } from './client';

async function runMigrations() {
  const migrationsDir = path.join(__dirname, 'migrations');
  const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();

  console.log('Running migrations...');

  for (const file of files) {
    const filePath = path.join(migrationsDir, file);
    const sql = fs.readFileSync(filePath, 'utf8');
    
    try {
      await pool.query(sql);
      console.log(`✓ Migrated: ${file}`);
    } catch (error) {
      console.error(`✗ Failed: ${file}`, error);
      throw error;
    }
  }

  console.log('All migrations completed successfully');
  await pool.end();
}

runMigrations().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});

