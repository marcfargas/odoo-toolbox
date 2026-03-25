/**
 * Copy package READMEs into docs/packages/ with VitePress frontmatter.
 *
 * Run before vitepress build to populate the Packages section.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../../..');

const packages = [
  {
    name: 'odoo-client',
    title: 'odoo-client',
    description: 'Lightweight TypeScript RPC client for Odoo',
  },
  {
    name: 'odoo-introspection',
    title: 'odoo-introspection',
    description: 'Runtime introspection and TypeScript code generation for Odoo models',
  },
  {
    name: 'odoo-state-manager',
    title: 'odoo-state-manager',
    description: 'Declarative state management for Odoo',
  },
  {
    name: 'odoo-testcontainers',
    title: 'odoo-testcontainers',
    description: 'Custom Testcontainers module for Odoo development',
  },
];

const outDir = resolve(ROOT, 'docs/packages');
mkdirSync(outDir, { recursive: true });

for (const pkg of packages) {
  const readmePath = resolve(ROOT, `packages/${pkg.name}/README.md`);
  let content: string;
  try {
    content = readFileSync(readmePath, 'utf-8');
  } catch {
    console.warn(`  skip  ${pkg.name} (no README.md)`);
    continue;
  }

  // Strip any existing H1 heading (VitePress uses frontmatter title)
  content = content.replace(/^# .+\n+/, '');

  const frontmatter = [
    '---',
    `title: "${pkg.title}"`,
    `description: "${pkg.description}"`,
    '---',
    '',
  ].join('\n');

  const outPath = resolve(outDir, `${pkg.name}.md`);
  writeFileSync(outPath, frontmatter + content, 'utf-8');
  console.log(`  copy  ${pkg.name}/README.md → docs/packages/${pkg.name}.md`);
}
