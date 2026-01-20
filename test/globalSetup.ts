import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

const CI = process.env.CI === 'true';
const COMPOSE_FILE = 'docker-compose.test.yml';
const ENV_FILE = '.env.test';

export default async function globalSetup() {
  if (CI) {
    // In GitHub Actions CI, services are handled by the workflow
    console.log('🔄 CI mode detected - skipping Docker setup');
    return;
  }

  // Load environment variables from .env.test
  if (fs.existsSync(ENV_FILE)) {
    const envContent = fs.readFileSync(ENV_FILE, 'utf-8');
    envContent.split('\n').forEach((line) => {
      const [key, value] = line.split('=');
      if (key && value && !key.startsWith('#')) {
        process.env[key.trim()] = value.trim();
      }
    });
  }

  console.log('🚀 Starting Odoo test environment...');

  try {
    // Check if containers are already running
    const psOutput = execSync('docker-compose -f docker-compose.test.yml ps --services --filter status=running', {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    if (psOutput.includes('odoo') && psOutput.includes('postgres')) {
      console.log('✅ Test containers already running');
      return;
    }

    // Start containers
    console.log('📦 Starting Docker containers...');
    execSync('docker-compose -f docker-compose.test.yml up -d', {
      stdio: 'inherit',
    });

    // Wait for Odoo to be ready
    console.log('⏳ Waiting for Odoo to be ready...');
    execSync('node scripts/wait-for-odoo.js', {
      stdio: 'inherit',
      env: process.env,
    });

    console.log('✅ Test environment ready');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('❌ Failed to start test environment:', errorMessage);
    process.exit(1);
  }
}
