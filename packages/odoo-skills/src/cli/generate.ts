#!/usr/bin/env ts-node
/**
 * CLI for generating Claude Code command files from SKILL definitions
 *
 * Usage:
 *   npx ts-node packages/odoo-skills/src/cli/generate.ts
 *   npm run skills:generate
 */

import * as path from 'path';
import * as fs from 'fs';
import { generateAllSkills, generateIndex } from '../generator';
import { skillRegistry } from '../registry';

async function main() {
  // Use current working directory (script is run from project root)
  const projectRoot = process.cwd();
  const outputDir = path.join(projectRoot, '.claude', 'commands');

  console.log('🔧 Odoo Toolbox SKILL Generator');
  console.log('================================\n');

  console.log(`📁 Output directory: ${outputDir}`);
  console.log(`📋 Total SKILLs: ${skillRegistry.skills.length}\n`);

  // Generate all skills
  console.log('Generating SKILL files...\n');

  const { generated, errors } = await generateAllSkills(outputDir);

  // Report results
  if (generated.length > 0) {
    console.log(`✅ Generated ${generated.length} SKILL files:`);
    generated.forEach((filepath) => {
      const filename = path.basename(filepath);
      console.log(`   - ${filename}`);
    });
  }

  if (errors.length > 0) {
    console.log(`\n❌ Errors (${errors.length}):`);
    errors.forEach(({ id, error }) => {
      console.log(`   - ${id}: ${error.message}`);
    });
  }

  // Generate index
  console.log('\nGenerating index...');
  const indexContent = generateIndex();
  const indexPath = path.join(outputDir, 'README.md');
  fs.writeFileSync(indexPath, indexContent, 'utf-8');
  console.log(`✅ Generated ${indexPath}`);

  // Summary
  console.log('\n================================');
  console.log('Summary:');
  console.log(`  Elementary: ${skillRegistry.getByLevel('elementary').length}`);
  console.log(`  User:       ${skillRegistry.getByLevel('user').length}`);
  console.log(`  Admin:      ${skillRegistry.getByLevel('admin').length}`);
  console.log('================================\n');

  if (errors.length > 0) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
