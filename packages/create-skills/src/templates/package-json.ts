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
      validate: 'npx @marcfargas/create-odoo-skills validate',
      test: 'npx @marcfargas/create-odoo-skills test',
      build: 'npx @marcfargas/create-odoo-skills build',
    },
    keywords: ['odoo', 'skills', 'ai-agent'],
    license: 'CC0-1.0',
  };

  return JSON.stringify(pkg, null, 2) + '\n';
}
