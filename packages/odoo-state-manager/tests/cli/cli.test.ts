import { describe, it, expect, afterEach } from 'vitest';
import { mkdtemp, readFile, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { initProject } from '../../src/cli/init';

// ---------------------------------------------------------------------------
// init command — creates files in a temp directory
// ---------------------------------------------------------------------------

describe('init command', () => {
  let tempDir: string;

  afterEach(async () => {
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it('creates tsconfig.json, modules.ts, and README.md', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'osm-init-test-'));
    await initProject(tempDir);

    const tsconfig = JSON.parse(await readFile(join(tempDir, 'tsconfig.json'), 'utf8'));
    expect(tsconfig).toHaveProperty('compilerOptions');
    expect(tsconfig.compilerOptions).toHaveProperty('target', 'ES2020');

    const modules = await readFile(join(tempDir, 'modules.ts'), 'utf8');
    expect(modules).toContain('import { resource }');
    expect(modules).toContain('ir.module.module');

    const readme = await readFile(join(tempDir, 'README.md'), 'utf8');
    expect(readme).toContain('odoo-state-manager');
  });

  it('scaffolds into a new subdirectory that does not yet exist', async () => {
    const base = await mkdtemp(join(tmpdir(), 'osm-init-test-'));
    tempDir = base;
    const subDir = join(base, 'my-odoo-project');

    await initProject(subDir);

    const modules = await readFile(join(subDir, 'modules.ts'), 'utf8');
    expect(modules).toContain('resource');
  });

  it('skips files that already exist', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'osm-init-test-'));

    // Pre-create modules.ts with custom content
    const customContent = '// my custom content\n';
    const { writeFile } = await import('fs/promises');
    await writeFile(join(tempDir, 'modules.ts'), customContent, 'utf8');

    await initProject(tempDir);

    // modules.ts should be unchanged
    const modules = await readFile(join(tempDir, 'modules.ts'), 'utf8');
    expect(modules).toBe(customContent);

    // Other files should still be created
    const tsconfig = await readFile(join(tempDir, 'tsconfig.json'), 'utf8');
    expect(tsconfig).toContain('compilerOptions');
  });
});
