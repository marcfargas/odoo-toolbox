#!/usr/bin/env node
/**
 * Post-build script for odoo-mcp package.
 * - Copies skill files from create-skills package
 * - Copies manifest.json to dist folder
 */
const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const SOURCE_DIR = path.resolve(__dirname, '../../create-skills/assets/initial');
const DEST_DIR = path.resolve(__dirname, '../dist/skills');

const CATEGORIES = ['base', 'mail', 'oca-modules'];

function copyManifest() {
  const src = path.join(ROOT_DIR, 'manifest.json');
  const dest = path.join(ROOT_DIR, 'dist', 'manifest.json');

  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dest);
    console.log('Copied manifest.json to dist/');
  }
}

function copySkills() {
  console.log('Copying skill files to dist/skills/...');

  // Clear destination
  if (fs.existsSync(DEST_DIR)) {
    fs.rmSync(DEST_DIR, { recursive: true });
  }
  fs.mkdirSync(DEST_DIR, { recursive: true });

  let totalFiles = 0;

  for (const category of CATEGORIES) {
    const srcCategoryDir = path.join(SOURCE_DIR, category);
    const destCategoryDir = path.join(DEST_DIR, category);

    if (!fs.existsSync(srcCategoryDir)) {
      console.log(`  Skipping ${category}/ (not found)`);
      continue;
    }

    fs.mkdirSync(destCategoryDir, { recursive: true });

    const files = fs.readdirSync(srcCategoryDir).filter((f) => f.endsWith('.md'));

    for (const file of files) {
      fs.copyFileSync(
        path.join(srcCategoryDir, file),
        path.join(destCategoryDir, file)
      );
    }

    console.log(`  Copied ${files.length} files from ${category}/`);
    totalFiles += files.length;
  }

  console.log(`Done. Total: ${totalFiles} skill files copied.`);
}

copySkills();
copyManifest();
