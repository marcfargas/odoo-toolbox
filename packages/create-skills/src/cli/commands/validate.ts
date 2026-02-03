/**
 * Validate command - Check skills and references
 */

import * as fs from 'fs';
import * as path from 'path';
import { validateSkillMd } from '../../validation/skill-validator';
import { checkReferences } from '../../validation/reference-checker';

interface ValidateOptions {
  quiet?: boolean;
}

export async function validateCommand(options: ValidateOptions): Promise<void> {
  const cwd = process.cwd();

  // Check if we're in a skills project
  const skillMdPath = path.join(cwd, 'SKILL.md');
  if (!fs.existsSync(skillMdPath)) {
    console.error('Error: SKILL.md not found. Are you in a skills project directory?');
    process.exit(1);
  }

  if (!options.quiet) {
    console.log('\nValidating skills...\n');
  }

  const results: Array<{ file: string; valid: boolean; message: string }> = [];
  let hasErrors = false;
  let hasWarnings = false;

  // Validate SKILL.md
  const skillMdContent = fs.readFileSync(skillMdPath, 'utf-8');
  const skillValidation = validateSkillMd(skillMdContent);

  if (skillValidation.valid) {
    results.push({ file: 'SKILL.md', valid: true, message: 'valid router' });
  } else {
    hasErrors = true;
    results.push({
      file: 'SKILL.md',
      valid: false,
      message: skillValidation.errors.join(', '),
    });
  }

  // Get all markdown files in base/ and skills/
  const baseDir = path.join(cwd, 'base');
  const skillsDir = path.join(cwd, 'skills');

  const allFiles: string[] = [];

  if (fs.existsSync(baseDir)) {
    const baseFiles = fs.readdirSync(baseDir).filter((f) => f.endsWith('.md'));
    allFiles.push(...baseFiles.map((f) => `base/${f}`));
  }

  if (fs.existsSync(skillsDir)) {
    const skillFiles = fs.readdirSync(skillsDir).filter((f) => f.endsWith('.md'));
    allFiles.push(...skillFiles.map((f) => `skills/${f}`));
  }

  // Check references
  const referenceResults = checkReferences(skillMdContent, allFiles);

  // Report referenced files
  for (const ref of referenceResults.referenced) {
    results.push({
      file: ref,
      valid: true,
      message: 'valid, referenced in SKILL.md',
    });
  }

  // Report unreferenced files (warnings)
  for (const unref of referenceResults.unreferenced) {
    hasWarnings = true;
    results.push({
      file: unref,
      valid: true, // File itself is valid, just not referenced
      message: 'exists but NOT referenced in SKILL.md',
    });
  }

  // Print results
  for (const result of results) {
    if (result.valid) {
      if (!options.quiet || result.message.includes('NOT referenced')) {
        const icon = result.message.includes('NOT referenced') ? '⚠' : '✓';
        console.log(`${icon} ${result.file} - ${result.message}`);
      }
    } else {
      console.log(`✗ ${result.file} - ${result.message}`);
    }
  }

  // Print warnings recommendation
  if (hasWarnings) {
    console.log('\n  Recommendation: Ask agent to update SKILL.md');
  }

  // Summary
  const validCount = results.filter((r) => r.valid && !r.message.includes('NOT referenced')).length;
  const warningCount = referenceResults.unreferenced.length;

  console.log(
    `\n${validCount} skills validated${warningCount > 0 ? `, ${warningCount} warning${warningCount > 1 ? 's' : ''}` : ''}.`
  );

  if (hasErrors) {
    process.exit(1);
  }
}
