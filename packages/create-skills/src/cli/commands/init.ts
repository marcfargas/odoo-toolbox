/**
 * Init command - Create new skills project
 *
 * Copies content from the top-level skills/ directory to create a
 * complete skills project for AI agents.
 */

import * as fs from 'fs';
import * as path from 'path';
import { generatePackageJson } from '../../templates/package-json';

interface InitOptions {
  git: boolean;
}

/**
 * Files that need {{PROJECT_NAME}} placeholder substitution
 */
const PLACEHOLDER_FILES = new Set(['SKILL.md', 'README.md']);

/**
 * Files/directories to skip when copying skills/ to a new project
 * (LICENSE is included separately as part of the project structure)
 */
const SKIP_FILES = new Set(['LICENSE']);

/**
 * Copy a file, optionally with placeholder substitution
 */
function copyFile(src: string, dest: string, projectName: string): void {
  const fileName = path.basename(src);

  if (PLACEHOLDER_FILES.has(fileName)) {
    let content = fs.readFileSync(src, 'utf-8');
    content = content.replace(/\{\{PROJECT_NAME\}\}/g, projectName);
    fs.writeFileSync(dest, content);
  } else {
    fs.copyFileSync(src, dest);
  }
}

/**
 * Recursively copy a directory with placeholder support
 */
function copyDirRecursive(src: string, dest: string, projectName: string): void {
  fs.mkdirSync(dest, { recursive: true });

  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath, projectName);
    } else {
      copyFile(srcPath, destPath, projectName);
    }
  }
}

/**
 * Find the skills/ directory by walking up from the compiled JS location.
 * In development: packages/create-skills/dist/cli/commands/ → skills/
 * When published: the skills/ dir must be bundled alongside the package.
 */
function findSkillsDir(): string | null {
  // Walk up from __dirname looking for skills/ with a SKILL.md entry point
  let dir = path.resolve(__dirname);
  for (let i = 0; i < 10; i++) {
    const candidate = path.join(dir, 'skills');
    if (fs.existsSync(candidate) && fs.existsSync(path.join(candidate, 'SKILL.md'))) {
      return candidate;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

export async function initCommand(projectName: string, options: InitOptions): Promise<void> {
  const projectPath = path.resolve(process.cwd(), projectName);

  // Check if directory already exists
  if (fs.existsSync(projectPath)) {
    console.error(`Error: Directory '${projectName}' already exists`);
    process.exit(1);
  }

  console.log(`\nCreating Odoo skills project: ${projectName}\n`);

  // Create project root
  fs.mkdirSync(projectPath, { recursive: true });

  // Find skills/ directory (top-level in monorepo)
  const skillsDir = findSkillsDir();

  if (!skillsDir) {
    console.error('Error: skills/ directory not found');
    process.exit(1);
  }

  // Copy skills/ content to project root
  const entries = fs.readdirSync(skillsDir, { withFileTypes: true });

  for (const entry of entries) {
    if (SKIP_FILES.has(entry.name)) continue;

    const srcPath = path.join(skillsDir, entry.name);
    const destPath = path.join(projectPath, entry.name);

    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath, projectName);
    } else {
      copyFile(srcPath, destPath, projectName);
    }
  }

  console.log('✓ Copied skill modules from skills/');

  // Create skills directory (for user-generated skills)
  fs.mkdirSync(path.join(projectPath, 'skills'), { recursive: true });
  fs.writeFileSync(
    path.join(projectPath, 'skills', '.gitkeep'),
    '# Instance-specific skills go here\n'
  );

  // Generate package.json (dynamic, not from assets)
  fs.writeFileSync(path.join(projectPath, 'package.json'), generatePackageJson(projectName));
  console.log('✓ Created package.json');

  // Create .gitignore
  fs.writeFileSync(
    path.join(projectPath, '.gitignore'),
    `.env
node_modules/
*.zip
`
  );

  // Initialize git
  if (options.git) {
    try {
      const { execSync } = await import('child_process');
      execSync('git init', { cwd: projectPath, stdio: 'ignore' });
      console.log('✓ Initialized git repository');
    } catch {
      console.log('⚠ Warning: Could not initialize git repository');
    }
  }

  console.log(`
Next steps:
  cd ${projectName}
  cp .env.example .env
  # Edit .env with your Odoo credentials

  # Start creating skills with your AI agent!
`);
}
