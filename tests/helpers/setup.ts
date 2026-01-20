import * as fs from 'fs';

// Load .env.test if it exists
const ENV_FILE = '.env.test';
if (fs.existsSync(ENV_FILE)) {
  const envContent = fs.readFileSync(ENV_FILE, 'utf-8');
  envContent.split('\n').forEach((line) => {
    const [key, value] = line.split('=');
    if (key && value && !key.startsWith('#')) {
      process.env[key.trim()] = value.trim();
    }
  });
}

// Global setup for all tests - runs after globalSetup but before tests
console.log(`Test environment configured:
  ODOO_URL: ${process.env.ODOO_URL || 'http://localhost:8069'}
  ODOO_DB: ${process.env.ODOO_DB_NAME || 'odoo'}
  CI: ${process.env.CI || 'false'}
`);
