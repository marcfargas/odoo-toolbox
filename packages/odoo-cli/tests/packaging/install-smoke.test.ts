/**
 * Packaging smoke test — validates that the published package works correctly.
 *
 * Flow:
 *   1. npm pack → .tgz
 *   2. npm install <tgz> in a temp dir
 *   3. Run the installed binary via `node <actual-dist/cli.js>` (not the shell shim)
 *   4. Assert exit 0 and semver output
 *   5. Cleanup temp dirs in afterAll
 *
 * This test requires the package to be built (`npm run build`) beforehand.
 * Run with: npm run test:packaging
 *
 * Note: .bin/odoo is a POSIX shell shim on Windows — unusable with `node`.
 * We resolve the actual JS entry from the installed package's package.json bin field.
 */

import { describe, it, expect, afterAll } from 'vitest';
import { spawnSync } from 'child_process';
import { resolve, join } from 'path';
import { existsSync, readdirSync, mkdtempSync, rmSync, readFileSync } from 'fs';
import { tmpdir } from 'os';

const PACKAGE_ROOT = resolve(__dirname, '../..');

// ── Temp dir management ───────────────────────────────────────────────

const tempDirs: string[] = [];

function makeTempDir(prefix: string): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

afterAll(() => {
  for (const dir of tempDirs) {
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      // best-effort cleanup
    }
  }
});

// ── Resolve actual JS bin path from installed package.json ───────────

/**
 * On Windows, `node_modules/.bin/odoo` is a shell shim — not executable by Node.
 * Read the bin field from the installed package's package.json and return the
 * absolute path to the actual JS entry point.
 */
function resolveInstalledBinJs(installDir: string, binName: string): string {
  // Find the package by scanning node_modules for a package.json with a matching bin
  const nodeModules = join(installDir, 'node_modules');
  // The tgz installs under the scoped name e.g. node_modules/@marcfargas/odoo-cli
  // Walk all entries including scoped packages
  const candidates: string[] = [];
  for (const entry of readdirSync(nodeModules)) {
    const entryPath = join(nodeModules, entry);
    if (entry.startsWith('@')) {
      for (const scopedEntry of readdirSync(entryPath)) {
        candidates.push(join(entryPath, scopedEntry));
      }
    } else {
      candidates.push(entryPath);
    }
  }

  for (const pkgDir of candidates) {
    const pkgJsonPath = join(pkgDir, 'package.json');
    if (!existsSync(pkgJsonPath)) continue;
    try {
      const pkg = JSON.parse(readFileSync(pkgJsonPath, 'utf8')) as {
        bin?: string | Record<string, string>;
      };
      const binField = pkg.bin;
      if (!binField) continue;
      const binRelPath =
        typeof binField === 'string' ? binField : (binField[binName] ?? binField['odoo-cli']);
      if (!binRelPath) continue;
      const absPath = resolve(pkgDir, binRelPath);
      if (existsSync(absPath)) return absPath;
    } catch {
      continue;
    }
  }

  throw new Error(
    `Could not resolve installed bin '${binName}' from any package in ${nodeModules}`
  );
}

// ── Pack + install once ──────────────────────────────────────────────

let installedBinJs: string | null = null;
let packError: string | null = null;

function ensurePackInstalled(): string {
  if (installedBinJs) return installedBinJs;
  if (packError) throw new Error(packError);

  // Step 1: npm pack → .tgz
  const packDir = makeTempDir('odoo-cli-pack-');
  const packResult = spawnSync('npm', ['pack', '--pack-destination', packDir], {
    cwd: PACKAGE_ROOT,
    encoding: 'utf8',
    timeout: 60_000,
    shell: true,
  });

  if (packResult.status !== 0) {
    packError = `npm pack failed:\n${packResult.stderr}`;
    throw new Error(packError);
  }

  const tgzFiles = readdirSync(packDir).filter((f) => f.endsWith('.tgz'));
  if (tgzFiles.length === 0) {
    packError = `npm pack produced no .tgz file in ${packDir}`;
    throw new Error(packError);
  }
  const tgzPath = join(packDir, tgzFiles[0]!);

  // Step 2: npm install <tgz> in a fresh temp dir
  //
  // During a changeset versioning run, workspace dependency ranges may
  // point to versions not yet published on npm (e.g. odoo-client@^0.5.0
  // when only 0.4.2 exists). We pass --install-strategy=shallow so npm
  // installs only the tgz itself without trying to resolve the full
  // transitive dependency tree from the registry. The smoke tests only
  // need the CLI entry point to be runnable — they don't exercise
  // functionality that depends on transitive packages.
  const installDir = makeTempDir('odoo-cli-install-');
  const installResult = spawnSync(
    'npm',
    ['install', tgzPath, '--no-save', '--no-package-lock', '--install-strategy=shallow'],
    {
      cwd: installDir,
      encoding: 'utf8',
      timeout: 60_000,
      shell: true,
    }
  );

  if (installResult.status !== 0) {
    packError = `npm install failed:\n${installResult.stderr}`;
    throw new Error(packError);
  }

  // Step 3: resolve the actual JS entry (not the shell shim)
  installedBinJs = resolveInstalledBinJs(installDir, 'odoo');
  return installedBinJs;
}

function runBin(
  args: string[],
  env?: Record<string, string>
): { stdout: string; stderr: string; exitCode: number } {
  const binJs = ensurePackInstalled();
  const result = spawnSync('node', [binJs, ...args], {
    encoding: 'utf8',
    env: {
      NO_COLOR: '1',
      PATH: process.env['PATH'],
      ...env,
    },
    timeout: 15_000,
  });
  return {
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
    exitCode: result.status ?? 1,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────

describe('packaging smoke tests (npm pack + install)', () => {
  it('dist/cli.js exists (package is built)', () => {
    const cliPath = resolve(PACKAGE_ROOT, 'dist/cli.js');
    expect(existsSync(cliPath)).toBe(true);
  });

  it('odoo --version exits 0 and outputs semver', () => {
    const { exitCode, stdout } = runBin(['--version']);
    expect(exitCode).toBe(0);
    expect(stdout.trim()).toMatch(/\d+\.\d+\.\d+/);
  }, 120_000);

  it('odoo --help exits 0', () => {
    const { exitCode, stdout } = runBin(['--help']);
    expect(exitCode).toBe(0);
    expect(stdout).toContain('odoo');
  }, 30_000);

  it('odoo --help shows command groups', () => {
    const { stdout } = runBin(['--help']);
    expect(stdout).toContain('config');
    expect(stdout).toContain('records');
    expect(stdout).toContain('mail');
    expect(stdout).toContain('modules');
  }, 30_000);

  it('odoo config check exits 2 with no credentials', () => {
    const { exitCode } = runBin(['config', 'check'], {
      ODOO_URL: '',
      ODOO_DB: '',
      ODOO_USERNAME: '',
      ODOO_PASSWORD: '',
    });
    expect(exitCode).toBe(2);
  }, 30_000);

  it('odoo records create requires --confirm (usage error)', () => {
    const { exitCode, stderr } = runBin(
      ['records', 'create', 'res.partner', '--data', '{"name":"Test"}'],
      {
        ODOO_URL: 'http://fake',
        ODOO_DB: 'fake',
        ODOO_USERNAME: 'fake',
        ODOO_PASSWORD: 'fake',
      }
    );
    expect(exitCode).toBe(1);
    expect(stderr).toMatch(/--confirm/i);
  }, 30_000);

  it('odoo records delete requires --confirm', () => {
    const { exitCode, stderr } = runBin(['records', 'delete', 'res.partner', '1'], {
      ODOO_URL: 'http://fake',
      ODOO_DB: 'fake',
      ODOO_USERNAME: 'fake',
      ODOO_PASSWORD: 'fake',
    });
    expect(exitCode).toBe(1);
    expect(stderr).toMatch(/--confirm/i);
  }, 30_000);

  it('odoo state plan requires --experimental', () => {
    const { exitCode, stderr } = runBin(['state', 'plan', 'nonexistent.json'], {
      ODOO_URL: 'http://fake',
      ODOO_DB: 'fake',
      ODOO_USERNAME: 'fake',
      ODOO_PASSWORD: 'fake',
    });
    expect(exitCode).toBe(1);
    expect(stderr).toMatch(/--experimental/i);
  }, 30_000);

  it('unknown command exits non-zero', () => {
    const { exitCode } = runBin(['completely-unknown-command-xyz']);
    expect(exitCode).not.toBe(0);
  }, 30_000);
});
