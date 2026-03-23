import { mkdir, writeFile, access } from 'fs/promises';
import { join } from 'path';

// ---------------------------------------------------------------------------
// File templates
// ---------------------------------------------------------------------------

const TSCONFIG = JSON.stringify(
  {
    compilerOptions: {
      target: 'ES2020',
      module: 'Node16',
      moduleResolution: 'Node16',
      strict: true,
      esModuleInterop: true,
    },
    include: ['*.ts'],
  },
  null,
  2
);

const MODULES_TS = `import { resource } from '@marcfargas/odoo-state-manager';

// Declare Odoo resources you want to manage.
// The state manager will detect drift and generate a plan to apply changes.

export const base = resource('ir.module.module', {
  name: 'base',
});
`;

const README_MD = `# Odoo State Manager Project

This directory contains your declarative Odoo state definitions.

## Usage

\`\`\`bash
# Preview changes (no writes)
odoo-state-manager plan

# Show drift
odoo-state-manager diff

# Apply changes (prompts for confirmation)
odoo-state-manager apply

# Apply without prompt
odoo-state-manager apply --auto-approve
\`\`\`

## Environment variables

Set these before running:

\`\`\`
ODOO_URL=https://your-odoo.example.com
ODOO_DB=your_database
ODOO_USER=admin
ODOO_PASSWORD=your_password
\`\`\`

## Resources

Define resources in \`.ts\` files using the \`resource()\` helper:

\`\`\`typescript
import { resource, lookup } from '@marcfargas/odoo-state-manager';

export const myGroup = resource('res.groups', {
  name: 'My Custom Group',
  category_id: lookup('ir.module.category', { name: 'Technical' }),
});
\`\`\`
`;

// ---------------------------------------------------------------------------
// initProject
// ---------------------------------------------------------------------------

/**
 * Scaffold a new odoo-state-manager project in the given directory.
 *
 * Creates:
 *   - tsconfig.json
 *   - modules.ts
 *   - README.md
 */
export async function initProject(dir: string): Promise<void> {
  // Create directory if it doesn't exist
  await mkdir(dir, { recursive: true });

  const files: Array<{ name: string; content: string }> = [
    { name: 'tsconfig.json', content: TSCONFIG + '\n' },
    { name: 'modules.ts', content: MODULES_TS },
    { name: 'README.md', content: README_MD },
  ];

  for (const file of files) {
    const filePath = join(dir, file.name);

    // Check if file already exists — warn and skip to avoid overwriting
    const exists = await access(filePath)
      .then(() => true)
      .catch(() => false);

    if (exists) {
      console.warn(`  skip  ${file.name} (already exists)`);
      continue;
    }

    await writeFile(filePath, file.content, 'utf8');
    console.log(`  create  ${file.name}`);
  }
}
