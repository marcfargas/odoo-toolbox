#!/usr/bin/env node
/**
 * Build Distribution
 *
 * Creates a complete distribution in dist/:
 * - dist/odoo-client.zip
 * - dist/odoo-introspection.zip
 * - dist/odoo-state-manager.zip
 * - dist/create-skills.zip
 * - dist/odoo-skills.zip
 *
 * Usage: npm run build:dist
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const archiver = require('archiver');

const rootDir = path.resolve(__dirname, '..');
const distDir = path.join(rootDir, 'dist');
const packagesDir = path.join(rootDir, 'packages');

const PACKAGES = [
  'odoo-client',
  'odoo-introspection',
  'odoo-state-manager',
  'create-skills',
];

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function createZip(sourceDir, outputPath, archiveName) {
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(outputPath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    output.on('close', () => resolve());
    archive.on('error', (err) => reject(err));

    archive.pipe(output);
    archive.directory(sourceDir, archiveName);
    archive.finalize();
  });
}

async function buildDist() {
  console.log('Building distribution...\n');

  // 1. Build all packages
  console.log('1. Building packages...');
  execSync('npm run build', { cwd: rootDir, stdio: 'inherit' });
  console.log('   Done.\n');

  // 2. Clean and create dist directory
  console.log('2. Preparing dist directory...');
  if (fs.existsSync(distDir)) {
    fs.rmSync(distDir, { recursive: true });
  }
  fs.mkdirSync(distDir, { recursive: true });
  console.log('   Done.\n');

  // 3. Create package zips
  console.log('3. Creating package zips...');
  const tempDir = path.join(distDir, '.temp');

  for (const pkg of PACKAGES) {
    const pkgDir = path.join(packagesDir, pkg);
    const pkgDistSrc = path.join(pkgDir, 'dist');

    if (fs.existsSync(pkgDistSrc)) {
      const zipPath = path.join(distDir, `${pkg}.zip`);
      const tempPkgDir = path.join(tempDir, pkg);

      // Prepare temp directory with package contents
      fs.mkdirSync(tempPkgDir, { recursive: true });
      copyDir(pkgDistSrc, path.join(tempPkgDir, 'dist'));

      // Copy package.json
      const pkgJsonSrc = path.join(pkgDir, 'package.json');
      if (fs.existsSync(pkgJsonSrc)) {
        fs.copyFileSync(pkgJsonSrc, path.join(tempPkgDir, 'package.json'));
      }

      // Copy README if exists
      const readmeSrc = path.join(pkgDir, 'README.md');
      if (fs.existsSync(readmeSrc)) {
        fs.copyFileSync(readmeSrc, path.join(tempPkgDir, 'README.md'));
      }

      // Create zip
      await createZip(tempPkgDir, zipPath, pkg);

      console.log(`   - ${pkg}.zip`);
    } else {
      console.log(`   - ${pkg} (no dist folder, skipping)`);
    }
  }

  // Cleanup temp
  if (fs.existsSync(tempDir)) {
    fs.rmSync(tempDir, { recursive: true });
  }
  console.log('   Done.\n');

  // 4. Build skills zip
  console.log('4. Building skills zip...');
  execSync('npm run build:skills-zip', { cwd: rootDir, stdio: 'inherit' });
  console.log('   Done.\n');

  // 5. Summary
  console.log('\nDistribution created in dist/:\n');
  const entries = fs.readdirSync(distDir, { withFileTypes: true });
  for (const entry of entries) {
    const stats = fs.statSync(path.join(distDir, entry.name));
    const size = (stats.size / 1024).toFixed(1);
    console.log(`  ${entry.name} (${size} KB)`);
  }
}

buildDist().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
