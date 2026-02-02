#!/usr/bin/env ts-node
/**
 * CLI for installing generated SKILLs to Claude Desktop global location
 *
 * Usage:
 *   npx ts-node packages/odoo-skills/src/cli/install.ts
 *   npm run skills:install
 */

import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

function getClaudeCommandsDir(): string {
  const homeDir = os.homedir();

  // Claude Desktop uses ~/.claude/commands/ on all platforms
  return path.join(homeDir, '.claude', 'commands');
}

function copyDirectory(src: string, dest: string): number {
  // Ensure destination exists
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }

  let filesCopied = 0;
  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      filesCopied += copyDirectory(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
      filesCopied++;
    }
  }

  return filesCopied;
}

async function main() {
  const projectRoot = process.cwd();
  const sourceDir = path.join(projectRoot, '.claude', 'commands');
  const destDir = getClaudeCommandsDir();

  console.log('📦 Installing Odoo SKILLs to Claude Desktop');
  console.log('============================================\n');

  // Check source exists
  if (!fs.existsSync(sourceDir)) {
    console.error('❌ Source directory not found:', sourceDir);
    console.error('   Run "npm run skills:generate" first.');
    process.exit(1);
  }

  console.log(`📁 Source: ${sourceDir}`);
  console.log(`📁 Destination: ${destDir}\n`);

  // Copy files
  const filesCopied = copyDirectory(sourceDir, destDir);

  console.log(`✅ Installed ${filesCopied} SKILL files to Claude Desktop`);
  console.log('\n💡 SKILLs are now available globally in Claude Code/Desktop.');
  console.log('   Use /odoo-connect, /odoo-introspect, etc. in any project.\n');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
