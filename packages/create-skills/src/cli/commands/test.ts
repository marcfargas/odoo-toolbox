/**
 * Test command - Test code examples against Odoo
 */

import * as fs from 'fs';
import * as path from 'path';
import { extractTestableBlocks } from '../../validation/markdown-tester';

interface TestOptions {
  file?: string;
}

export async function testCommand(options: TestOptions): Promise<void> {
  const cwd = process.cwd();

  // Check for .env file
  const envPath = path.join(cwd, '.env');
  if (!fs.existsSync(envPath)) {
    console.error('Error: .env file not found. Copy .env.example and configure your Odoo credentials.');
    process.exit(1);
  }

  // Load environment variables
  const envContent = fs.readFileSync(envPath, 'utf-8');
  const envVars = parseEnv(envContent);

  const odooUrl = envVars.ODOO_URL || process.env.ODOO_URL;
  if (!odooUrl) {
    console.error('Error: ODOO_URL not configured in .env');
    process.exit(1);
  }

  console.log('\nTesting code examples...');
  console.log(`Using Odoo at ${odooUrl}\n`);

  // Get files to test
  let filesToTest: string[] = [];

  if (options.file) {
    if (!fs.existsSync(options.file)) {
      console.error(`Error: File not found: ${options.file}`);
      process.exit(1);
    }
    filesToTest = [options.file];
  } else {
    // Test all markdown files in base/ and skills/
    const baseDir = path.join(cwd, 'base');
    const skillsDir = path.join(cwd, 'skills');

    if (fs.existsSync(baseDir)) {
      const baseFiles = fs.readdirSync(baseDir)
        .filter((f) => f.endsWith('.md'))
        .map((f) => path.join(baseDir, f));
      filesToTest.push(...baseFiles);
    }

    if (fs.existsSync(skillsDir)) {
      const skillFiles = fs.readdirSync(skillsDir)
        .filter((f) => f.endsWith('.md'))
        .map((f) => path.join(skillsDir, f));
      filesToTest.push(...skillFiles);
    }
  }

  if (filesToTest.length === 0) {
    console.log('No markdown files found to test.');
    return;
  }

  let totalPassed = 0;
  const totalFailed = 0;

  for (const file of filesToTest) {
    const content = fs.readFileSync(file, 'utf-8');
    const blocks = extractTestableBlocks(content, file);

    if (blocks.length === 0) {
      continue;
    }

    const relativePath = path.relative(cwd, file);

    // For now, just report that we found testable blocks
    // Full execution requires @odoo-toolbox/client which is a peer dependency
    const passedCount = blocks.length; // TODO: Actually execute tests
    totalPassed += passedCount;

    console.log(`✓ ${relativePath} - ${passedCount} examples found`);
  }

  if (totalPassed === 0 && totalFailed === 0) {
    console.log('No testable code examples found.');
    console.log('Add `testable` annotation to code blocks to make them testable.');
    return;
  }

  console.log(`\n${totalFailed === 0 ? 'All' : totalPassed} ${totalPassed === 1 ? 'example' : 'examples'} found.`);

  // TODO: Actually execute the code blocks and report pass/fail
  console.log('\nNote: Full test execution requires @odoo-toolbox/client.');
  console.log('Install with: npm install @odoo-toolbox/client @odoo-toolbox/introspection');

  if (totalFailed > 0) {
    process.exit(1);
  }
}

function parseEnv(content: string): Record<string, string> {
  const vars: Record<string, string> = {};
  const lines = content.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const eqIndex = trimmed.indexOf('=');
    if (eqIndex > 0) {
      const key = trimmed.substring(0, eqIndex).trim();
      let value = trimmed.substring(eqIndex + 1).trim();
      // Remove quotes if present
      if ((value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      vars[key] = value;
    }
  }

  return vars;
}
