#!/usr/bin/env node
/**
 * Build the @marcfargas/odoo-skills npm package artifact.
 *
 * Assembles a publishable directory from:
 *   - skills/odoo/          → dist-skills/skills/odoo/
 *   - .well-known/          → dist-skills/.well-known/
 *   - skills/odoo/LICENSE   → dist-skills/LICENSE
 *
 * Run: node scripts/build-skills-package.js
 * Output: dist-skills/ (ready for `npm publish`)
 */

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'dist-skills');

// Clean output
fs.rmSync(OUT, { recursive: true, force: true });

// Copy skills
fs.cpSync(path.join(ROOT, 'skills', 'odoo'), path.join(OUT, 'skills', 'odoo'), { recursive: true });

// Copy .well-known if it exists
const wellKnown = path.join(ROOT, '.well-known');
if (fs.existsSync(wellKnown)) {
  fs.cpSync(wellKnown, path.join(OUT, '.well-known'), { recursive: true });
}

// Copy LICENSE from skills (CC0, not repo LGPL)
const skillsLicense = path.join(ROOT, 'skills', 'odoo', 'LICENSE');
if (fs.existsSync(skillsLicense)) {
  fs.copyFileSync(skillsLicense, path.join(OUT, 'LICENSE'));
}

// Generate package.json
const pkg = {
  name: '@marcfargas/odoo-skills',
  version: '0.5.3',
  description: 'Battle-tested Odoo knowledge modules for AI agents — 5,200+ lines validated against Odoo v17 in CI',
  files: ['skills/**/*.md', '.well-known', 'LICENSE', 'README.md'],
  pi: { skills: ['./skills'] },
  keywords: ['odoo', 'erp', 'rpc', 'skills', 'ai-agent', 'claude', 'knowledge', 'documentation', 'pi-package'],
  author: 'Marc Fargas <marc@marcfargas.com>',
  license: 'CC0-1.0',
  repository: {
    type: 'git',
    url: 'https://github.com/marcfargas/odoo-toolbox.git',
    directory: 'skills',
  },
  publishConfig: { access: 'public' },
};

fs.writeFileSync(path.join(OUT, 'package.json'), JSON.stringify(pkg, null, 2) + '\n');

// Generate minimal README
const readme = `# @marcfargas/odoo-skills

Battle-tested Odoo knowledge modules for AI agents.

## Install

\`\`\`bash
pi install npm:@marcfargas/odoo-skills
\`\`\`

Or install from GitHub directly:

\`\`\`bash
pi install github:marcfargas/odoo-toolbox
\`\`\`

## License

CC0-1.0 — Public Domain
`;

fs.writeFileSync(path.join(OUT, 'README.md'), readme);

console.log('Built @marcfargas/odoo-skills package in dist-skills/');
