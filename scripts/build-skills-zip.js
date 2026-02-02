#!/usr/bin/env node
/**
 * Build odoo-skills.zip
 *
 * Creates a distributable zip file containing a complete skills project
 * that can be used with any AI agent supporting skills.
 *
 * Usage: npm run build:skills-zip
 * Output: dist/odoo-skills.zip
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const archiver = require('archiver');

const PROJECT_NAME = 'odoo-skills';

async function buildSkillsZip() {
  console.log('Building odoo-skills.zip...\n');

  // Paths
  const rootDir = path.resolve(__dirname, '..');
  const cliPath = path.join(rootDir, 'packages', 'create-skills', 'dist', 'cli', 'cli.js');
  const distDir = path.join(rootDir, 'dist');
  const zipPath = path.join(distDir, 'odoo-skills.zip');

  // Verify CLI is built
  if (!fs.existsSync(cliPath)) {
    console.error('Error: create-skills CLI not built. Run "npm run build" first.');
    process.exit(1);
  }

  // Create temp workspace
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'odoo-skills-build-'));
  const projectDir = path.join(tempDir, PROJECT_NAME);

  try {
    // Run CLI to create project
    console.log('1. Creating skills project...');
    execSync(`node "${cliPath}" ${PROJECT_NAME} --no-git`, {
      cwd: tempDir,
      stdio: 'pipe',
    });
    console.log('   Done.\n');

    // Verify project was created
    if (!fs.existsSync(projectDir)) {
      throw new Error('Project directory was not created');
    }

    // Ensure dist directory exists
    fs.mkdirSync(distDir, { recursive: true });

    // Remove existing zip if present
    if (fs.existsSync(zipPath)) {
      fs.unlinkSync(zipPath);
    }

    // Create zip
    console.log('2. Creating zip archive...');
    await createZip(projectDir, zipPath);
    console.log('   Done.\n');

    // Get file size
    const stats = fs.statSync(zipPath);
    const sizeMB = (stats.size / 1024 / 1024).toFixed(2);

    console.log(`Successfully created: ${zipPath}`);
    console.log(`Size: ${sizeMB} MB`);
  } finally {
    // Cleanup temp directory
    console.log('\n3. Cleaning up...');
    fs.rmSync(tempDir, { recursive: true, force: true });
    console.log('   Done.');
  }
}

function createZip(sourceDir, outputPath) {
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(outputPath);
    const archive = archiver('zip', {
      zlib: { level: 9 }, // Maximum compression
    });

    output.on('close', () => {
      resolve();
    });

    archive.on('error', (err) => {
      reject(err);
    });

    archive.pipe(output);

    // Add the project directory contents
    archive.directory(sourceDir, 'odoo-skills');

    archive.finalize();
  });
}

// Run
buildSkillsZip().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
