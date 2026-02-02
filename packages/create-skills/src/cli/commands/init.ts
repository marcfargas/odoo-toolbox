/**
 * Init command - Create new skills project
 */

import * as fs from 'fs';
import * as path from 'path';
import { generatePackageJson } from '../../templates/package-json';

interface InitOptions {
  git: boolean;
}

/**
 * Copy a file with placeholder substitution
 */
function copyWithPlaceholders(
  src: string,
  dest: string,
  projectName: string
): void {
  let content = fs.readFileSync(src, 'utf-8');
  content = content.replace(/\{\{PROJECT_NAME\}\}/g, projectName);
  fs.writeFileSync(dest, content);
}

/**
 * Copy a directory recursively
 */
function copyDirectory(src: string, dest: string): void {
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDirectory(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

export async function initCommand(
  projectName: string,
  options: InitOptions
): Promise<void> {
  const projectPath = path.resolve(process.cwd(), projectName);

  // Check if directory already exists
  if (fs.existsSync(projectPath)) {
    console.error(`Error: Directory '${projectName}' already exists`);
    process.exit(1);
  }

  console.log(`\nCreating Odoo skills project: ${projectName}\n`);

  // Create directory structure
  const directories = [
    projectPath,
    path.join(projectPath, 'base'),
    path.join(projectPath, 'skills'),
  ];

  for (const dir of directories) {
    fs.mkdirSync(dir, { recursive: true });
  }
  console.log('✓ Created project structure');

  // Path to assets directory (relative to compiled JS location)
  const assetsDir = path.resolve(__dirname, '..', '..', '..', 'assets');

  // Copy base modules from assets/base
  const assetsBase = path.join(assetsDir, 'base');
  if (fs.existsSync(assetsBase)) {
    const baseFiles = fs.readdirSync(assetsBase);
    for (const file of baseFiles) {
      if (file.endsWith('.md')) {
        fs.copyFileSync(
          path.join(assetsBase, file),
          path.join(projectPath, 'base', file)
        );
      }
    }
    console.log('✓ Installed base modules');
  } else {
    console.log('⚠ Warning: Base modules not found (development mode)');
    fs.writeFileSync(
      path.join(projectPath, 'base', '.gitkeep'),
      '# Base modules will be installed here\n'
    );
  }

  // Create skills/.gitkeep
  fs.writeFileSync(
    path.join(projectPath, 'skills', '.gitkeep'),
    '# Instance-specific skills go here\n'
  );

  // Copy static template files with placeholder substitution
  const templatesWithPlaceholders = ['SKILL.md', 'README.md'];
  const staticTemplates = ['AGENTS.md', '.env.example'];

  for (const template of templatesWithPlaceholders) {
    const src = path.join(assetsDir, template);
    if (fs.existsSync(src)) {
      copyWithPlaceholders(src, path.join(projectPath, template), projectName);
    }
  }
  console.log('✓ Created SKILL.md router');

  for (const template of staticTemplates) {
    const src = path.join(assetsDir, template);
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, path.join(projectPath, template));
    }
  }

  // Generate package.json (only dynamic template)
  fs.writeFileSync(
    path.join(projectPath, 'package.json'),
    generatePackageJson(projectName)
  );
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
