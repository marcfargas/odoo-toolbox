#!/usr/bin/env node

import http from 'http';

const URL = process.env.ODOO_URL || 'http://localhost:8069';
const MAX_ATTEMPTS = parseInt(process.env.WAIT_ATTEMPTS || '60', 10);
const INTERVAL_MS = parseInt(process.env.WAIT_INTERVAL || '2000', 10);

async function waitForOdoo(maxAttempts = MAX_ATTEMPTS) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await new Promise((resolve, reject) => {
        const req = http.get(URL + '/web/health', { timeout: 5000 }, (res) => {
          if (res.statusCode === 200) {
            resolve();
          } else {
            reject(new Error(`Status code: ${res.statusCode}`));
          }
        });

        req.on('error', reject);
        req.on('timeout', () => {
          req.destroy();
          reject(new Error('Request timeout'));
        });
      });

      console.log(`✅ Odoo is ready at ${URL}`);
      process.exit(0);
    } catch (error) {
      if (attempt < maxAttempts) {
        console.log(`⏳ Waiting for Odoo... (${attempt}/${maxAttempts}) - ${error.message}`);
        await new Promise((resolve) => setTimeout(resolve, INTERVAL_MS));
      } else {
        console.error(`❌ Odoo failed to start after ${maxAttempts} attempts`);
        console.error(`   Last error: ${error.message}`);
        process.exit(1);
      }
    }
  }
}

waitForOdoo().catch((err) => {
  console.error('❌ Unexpected error:', err);
  process.exit(1);
});
