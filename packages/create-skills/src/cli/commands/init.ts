/**
 * Init command - Create new skills project
 *
 * Copies ALL content from assets/ to create a complete skills project.
 * The assets/initial/ directory contents are merged into the project root.
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
 * Directory name mappings (source → destination)
 */
const DIR_MAPPINGS: Record<string, string> = {
  'oca-modules': 'modules',
};

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
    // Apply directory mapping if exists
    const destName = DIR_MAPPINGS[entry.name] || entry.name;
    const destPath = path.join(dest, destName);

    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath, projectName);
    } else {
      copyFile(srcPath, destPath, projectName);
    }
  }
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

  // Path to assets directory (relative to compiled JS location)
  const assetsDir = path.resolve(__dirname, '..', '..', '..', 'assets');

  if (!fs.existsSync(assetsDir)) {
    console.error('Error: assets directory not found');
    process.exit(1);
  }

  // Copy ALL content from assets/ to project
  const entries = fs.readdirSync(assetsDir, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(assetsDir, entry.name);

    if (entry.isDirectory()) {
      if (entry.name === 'initial') {
        // Special case: initial/ contents are merged into project root
        const initialEntries = fs.readdirSync(srcPath, { withFileTypes: true });
        for (const initialEntry of initialEntries) {
          const initialSrcPath = path.join(srcPath, initialEntry.name);
          const destName = DIR_MAPPINGS[initialEntry.name] || initialEntry.name;
          const destPath = path.join(projectPath, destName);

          if (initialEntry.isDirectory()) {
            copyDirRecursive(initialSrcPath, destPath, projectName);
          } else {
            copyFile(initialSrcPath, destPath, projectName);
          }
        }
      } else {
        // Regular directory: copy as-is
        const destName = DIR_MAPPINGS[entry.name] || entry.name;
        copyDirRecursive(srcPath, path.join(projectPath, destName), projectName);
      }
    } else {
      // Regular file: copy to project root
      copyFile(srcPath, path.join(projectPath, entry.name), projectName);
    }
  }

  console.log('✓ Copied skill modules from assets/');

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
