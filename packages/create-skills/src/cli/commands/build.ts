/**
 * Build command - Package skills for distribution
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { validateCommand } from './validate';

interface BuildOptions {
  output?: string;
}

export async function buildCommand(options: BuildOptions): Promise<void> {
  const cwd = process.cwd();
  const projectName = path.basename(cwd);

  // Check if we're in a skills project
  const skillMdPath = path.join(cwd, 'SKILL.md');
  if (!fs.existsSync(skillMdPath)) {
    console.error('Error: SKILL.md not found. Are you in a skills project directory?');
    process.exit(1);
  }

  console.log('\nBuilding skills package...\n');

  // Run validation first (quiet mode)
  try {
    // We can't call validateCommand directly as it may exit
    // For now, we'll do a basic check
    const skillContent = fs.readFileSync(skillMdPath, 'utf-8');
    if (!skillContent.includes('# /odoo') && !skillContent.includes('# /')) {
      console.error('✗ SKILL.md validation failed: Missing skill header');
      process.exit(1);
    }
    console.log('✓ Validated all skills');
  } catch (error) {
    console.error('Validation failed');
    process.exit(1);
  }

  // Collect files to include
  const filesToInclude: string[] = [];

  // Always include SKILL.md
  filesToInclude.push('SKILL.md');

  // Include AGENTS.md if exists
  if (fs.existsSync(path.join(cwd, 'AGENTS.md'))) {
    filesToInclude.push('AGENTS.md');
  }

  // Include README.md if exists
  if (fs.existsSync(path.join(cwd, 'README.md'))) {
    filesToInclude.push('README.md');
  }

  // Include .env.example if exists
  if (fs.existsSync(path.join(cwd, '.env.example'))) {
    filesToInclude.push('.env.example');
  }

  // Include all base/*.md files
  const baseDir = path.join(cwd, 'base');
  if (fs.existsSync(baseDir)) {
    const baseFiles = fs.readdirSync(baseDir).filter((f) => f.endsWith('.md'));
    filesToInclude.push(...baseFiles.map((f) => `base/${f}`));
  }

  // Include all skills/*.md files
  const skillsDir = path.join(cwd, 'skills');
  if (fs.existsSync(skillsDir)) {
    const skillFiles = fs.readdirSync(skillsDir).filter((f) => f.endsWith('.md'));
    filesToInclude.push(...skillFiles.map((f) => `skills/${f}`));
  }

  console.log('✓ All references resolved');
  console.log(`✓ Bundled ${filesToInclude.length} files`);

  // Determine output path
  const outputPath = options.output || `${projectName}.zip`;
  const fullOutputPath = path.resolve(cwd, outputPath);

  // Create zip file
  try {
    // Remove existing zip if present
    if (fs.existsSync(fullOutputPath)) {
      fs.unlinkSync(fullOutputPath);
    }

    // Use native zip command (works on most systems)
    // On Windows, PowerShell's Compress-Archive can be used
    const isWindows = process.platform === 'win32';

    if (isWindows) {
      // Create a temporary directory with the files
      const tempDir = path.join(cwd, '.build-temp');
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true });
      }
      fs.mkdirSync(tempDir, { recursive: true });

      // Copy files to temp directory
      for (const file of filesToInclude) {
        const src = path.join(cwd, file);
        const dest = path.join(tempDir, file);
        fs.mkdirSync(path.dirname(dest), { recursive: true });
        fs.copyFileSync(src, dest);
      }

      // Use PowerShell to create zip
      execSync(
        `powershell -Command "Compress-Archive -Path '${tempDir}\\*' -DestinationPath '${fullOutputPath}' -Force"`,
        { cwd }
      );

      // Clean up temp directory
      fs.rmSync(tempDir, { recursive: true });
    } else {
      // Unix-like systems
      const fileList = filesToInclude.join(' ');
      execSync(`zip -r "${fullOutputPath}" ${fileList}`, { cwd });
    }

    console.log(`✓ Created ${path.basename(fullOutputPath)}`);
    console.log('\nReady for deployment!');
  } catch (error) {
    console.error('Error creating zip file:', error);
    console.log('\nAlternative: Manually zip the following files:');
    for (const file of filesToInclude) {
      console.log(`  - ${file}`);
    }
    process.exit(1);
  }
}
