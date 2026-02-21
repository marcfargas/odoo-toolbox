#!/usr/bin/env node
/**
 * Build odoo-skills.zip
 *
 * Creates a distributable zip file containing the odoo skills package
 * that can be used with any AI agent supporting pi skills.
 *
 * Prerequisites: run `npm run build` first so that
 * packages/odoo-skills/skills/odoo/ is populated by copy-skills.js.
 *
 * Usage: npm run build:skills-zip
 * Output: dist/odoo-skills.zip
 *
 * Zip layout:
 *   odoo-skills/
 *     SKILL.md          ← top-level skill entry point
 *     package.json      ← package metadata
 *     odoo/             ← all skill files (base/, cli/, mail/, modules/, oca/, …)
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const archiver = require('archiver');

const PROJECT_NAME = 'odoo-skills';

async function buildSkillsZip() {
  console.log('Building odoo-skills.zip...\n');

  // Paths
  const rootDir = path.resolve(__dirname, '..');
  const skillsPackageDir = path.join(rootDir, 'packages', 'odoo-skills');
  const odooSkillsDir = path.join(skillsPackageDir, 'skills', 'odoo');
  const skillMdPath = path.join(rootDir, 'skills', 'odoo', 'SKILL.md');
  const packageJsonPath = path.join(skillsPackageDir, 'package.json');
  const distDir = path.join(rootDir, 'dist');
  const zipPath = path.join(distDir, 'odoo-skills.zip');

  // Verify sources exist
  if (!fs.existsSync(odooSkillsDir)) {
    console.error(
      `Error: Skills directory not found: ${odooSkillsDir}\n` +
        'Run "npm run build" first to copy skills into the package.'
    );
    process.exit(1);
  }

  if (!fs.existsSync(skillMdPath)) {
    console.error(`Error: SKILL.md not found: ${skillMdPath}`);
    process.exit(1);
  }

  if (!fs.existsSync(packageJsonPath)) {
    console.error(`Error: package.json not found: ${packageJsonPath}`);
    process.exit(1);
  }

  // Create temp workspace
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'odoo-skills-build-'));
  const projectDir = path.join(tempDir, PROJECT_NAME);

  try {
    // 1. Create the target directory structure
    console.log('1. Assembling skills package...');
    fs.mkdirSync(projectDir, { recursive: true });

    // Copy odoo/ skills tree → odoo-skills/odoo/
    const destOdooDir = path.join(projectDir, 'odoo');
    fs.cpSync(odooSkillsDir, destOdooDir, { recursive: true });

    // Copy SKILL.md → odoo-skills/SKILL.md
    fs.copyFileSync(skillMdPath, path.join(projectDir, 'SKILL.md'));

    // Copy package.json → odoo-skills/package.json
    fs.copyFileSync(packageJsonPath, path.join(projectDir, 'package.json'));

    console.log('   Done.\n');

    // Ensure dist directory exists
    fs.mkdirSync(distDir, { recursive: true });

    // Remove existing zip if present
    if (fs.existsSync(zipPath)) {
      fs.unlinkSync(zipPath);
    }

    // 2. Create zip
    console.log('2. Creating zip archive...');
    await createZip(projectDir, PROJECT_NAME, zipPath);
    console.log('   Done.\n');

    // Report size
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

/**
 * Zip the contents of sourceDir into outputPath, placing them under the
 * given prefix (e.g. "odoo-skills/") inside the archive.
 */
function createZip(sourceDir, prefix, outputPath) {
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

    // Add directory contents under the prefix folder
    archive.directory(sourceDir, prefix);

    archive.finalize();
  });
}

// Run
buildSkillsZip().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
