/**
 * package.json template generator
 */

export function generatePackageJson(projectName: string): string {
  const pkg = {
    name: projectName,
    version: '0.1.0',
    private: true,
    description: 'Odoo skills for AI agent integration',
    scripts: {
      validate: 'npx @odoo-toolbox/create-skills validate',
      test: 'npx @odoo-toolbox/create-skills test',
      build: 'npx @odoo-toolbox/create-skills build',
    },
    keywords: ['odoo', 'skills', 'ai-agent'],
    license: 'CC0-1.0',
  };

  return JSON.stringify(pkg, null, 2) + '\n';
}
