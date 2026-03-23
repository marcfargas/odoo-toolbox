"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const child_process_1 = require("child_process");
const path_1 = require("path");
const fs_1 = require("fs");
const os_1 = require("os");
const PACKAGE_ROOT = (0, path_1.resolve)(__dirname, '../..');
// ── Temp dir management ───────────────────────────────────────────────
const tempDirs = [];
function makeTempDir(prefix) {
    const dir = (0, fs_1.mkdtempSync)((0, path_1.join)((0, os_1.tmpdir)(), prefix));
    tempDirs.push(dir);
    return dir;
}
(0, vitest_1.afterAll)(() => {
    for (const dir of tempDirs) {
        try {
            (0, fs_1.rmSync)(dir, { recursive: true, force: true });
        }
        catch {
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
function resolveInstalledBinJs(installDir, binName) {
    // Find the package by scanning node_modules for a package.json with a matching bin
    const nodeModules = (0, path_1.join)(installDir, 'node_modules');
    // The tgz installs under the scoped name e.g. node_modules/@marcfargas/odoo-cli
    // Walk all entries including scoped packages
    const candidates = [];
    for (const entry of (0, fs_1.readdirSync)(nodeModules)) {
        const entryPath = (0, path_1.join)(nodeModules, entry);
        if (entry.startsWith('@')) {
            for (const scopedEntry of (0, fs_1.readdirSync)(entryPath)) {
                candidates.push((0, path_1.join)(entryPath, scopedEntry));
            }
        }
        else {
            candidates.push(entryPath);
        }
    }
    for (const pkgDir of candidates) {
        const pkgJsonPath = (0, path_1.join)(pkgDir, 'package.json');
        if (!(0, fs_1.existsSync)(pkgJsonPath))
            continue;
        try {
            const pkg = JSON.parse((0, fs_1.readFileSync)(pkgJsonPath, 'utf8'));
            const binField = pkg.bin;
            if (!binField)
                continue;
            const binRelPath = typeof binField === 'string' ? binField : (binField[binName] ?? binField['odoo-cli']);
            if (!binRelPath)
                continue;
            const absPath = (0, path_1.resolve)(pkgDir, binRelPath);
            if ((0, fs_1.existsSync)(absPath))
                return absPath;
        }
        catch {
            continue;
        }
    }
    throw new Error(`Could not resolve installed bin '${binName}' from any package in ${nodeModules}`);
}
// ── Pack + install once ──────────────────────────────────────────────
let installedBinJs = null;
let packError = null;
function ensurePackInstalled() {
    if (installedBinJs)
        return installedBinJs;
    if (packError)
        throw new Error(packError);
    // Step 1: npm pack → .tgz
    const packDir = makeTempDir('odoo-cli-pack-');
    const packResult = (0, child_process_1.spawnSync)('npm', ['pack', '--pack-destination', packDir], {
        cwd: PACKAGE_ROOT,
        encoding: 'utf8',
        timeout: 60_000,
        shell: true,
    });
    if (packResult.status !== 0) {
        packError = `npm pack failed:\n${packResult.stderr}`;
        throw new Error(packError);
    }
    const tgzFiles = (0, fs_1.readdirSync)(packDir).filter((f) => f.endsWith('.tgz'));
    if (tgzFiles.length === 0) {
        packError = `npm pack produced no .tgz file in ${packDir}`;
        throw new Error(packError);
    }
    const tgzPath = (0, path_1.join)(packDir, tgzFiles[0]);
    // Step 2: npm install <tgz> in a fresh temp dir
    const installDir = makeTempDir('odoo-cli-install-');
    const installResult = (0, child_process_1.spawnSync)('npm', ['install', tgzPath, '--no-save', '--no-package-lock'], {
        cwd: installDir,
        encoding: 'utf8',
        timeout: 60_000,
        shell: true,
    });
    if (installResult.status !== 0) {
        packError = `npm install failed:\n${installResult.stderr}`;
        throw new Error(packError);
    }
    // Step 3: resolve the actual JS entry (not the shell shim)
    installedBinJs = resolveInstalledBinJs(installDir, 'odoo');
    return installedBinJs;
}
function runBin(args, env) {
    const binJs = ensurePackInstalled();
    const result = (0, child_process_1.spawnSync)('node', [binJs, ...args], {
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
(0, vitest_1.describe)('packaging smoke tests (npm pack + install)', () => {
    (0, vitest_1.it)('dist/cli.js exists (package is built)', () => {
        const cliPath = (0, path_1.resolve)(PACKAGE_ROOT, 'dist/cli.js');
        (0, vitest_1.expect)((0, fs_1.existsSync)(cliPath)).toBe(true);
    });
    (0, vitest_1.it)('odoo --version exits 0 and outputs semver', () => {
        const { exitCode, stdout } = runBin(['--version']);
        (0, vitest_1.expect)(exitCode).toBe(0);
        (0, vitest_1.expect)(stdout.trim()).toMatch(/\d+\.\d+\.\d+/);
    }, 120_000);
    (0, vitest_1.it)('odoo --help exits 0', () => {
        const { exitCode, stdout } = runBin(['--help']);
        (0, vitest_1.expect)(exitCode).toBe(0);
        (0, vitest_1.expect)(stdout).toContain('odoo');
    }, 30_000);
    (0, vitest_1.it)('odoo --help shows command groups', () => {
        const { stdout } = runBin(['--help']);
        (0, vitest_1.expect)(stdout).toContain('config');
        (0, vitest_1.expect)(stdout).toContain('records');
        (0, vitest_1.expect)(stdout).toContain('mail');
        (0, vitest_1.expect)(stdout).toContain('modules');
    }, 30_000);
    (0, vitest_1.it)('odoo config check exits 2 with no credentials', () => {
        const { exitCode } = runBin(['config', 'check'], {
            ODOO_URL: '',
            ODOO_DB: '',
            ODOO_USERNAME: '',
            ODOO_PASSWORD: '',
        });
        (0, vitest_1.expect)(exitCode).toBe(2);
    }, 30_000);
    (0, vitest_1.it)('odoo records create requires --confirm (usage error)', () => {
        const { exitCode, stderr } = runBin(['records', 'create', 'res.partner', '--data', '{"name":"Test"}'], {
            ODOO_URL: 'http://fake',
            ODOO_DB: 'fake',
            ODOO_USERNAME: 'fake',
            ODOO_PASSWORD: 'fake',
        });
        (0, vitest_1.expect)(exitCode).toBe(1);
        (0, vitest_1.expect)(stderr).toMatch(/--confirm/i);
    }, 30_000);
    (0, vitest_1.it)('odoo records delete requires --confirm', () => {
        const { exitCode, stderr } = runBin(['records', 'delete', 'res.partner', '1'], {
            ODOO_URL: 'http://fake',
            ODOO_DB: 'fake',
            ODOO_USERNAME: 'fake',
            ODOO_PASSWORD: 'fake',
        });
        (0, vitest_1.expect)(exitCode).toBe(1);
        (0, vitest_1.expect)(stderr).toMatch(/--confirm/i);
    }, 30_000);
    (0, vitest_1.it)('odoo state plan requires --experimental', () => {
        const { exitCode, stderr } = runBin(['state', 'plan', 'nonexistent.json'], {
            ODOO_URL: 'http://fake',
            ODOO_DB: 'fake',
            ODOO_USERNAME: 'fake',
            ODOO_PASSWORD: 'fake',
        });
        (0, vitest_1.expect)(exitCode).toBe(1);
        (0, vitest_1.expect)(stderr).toMatch(/--experimental/i);
    }, 30_000);
    (0, vitest_1.it)('unknown command exits non-zero', () => {
        const { exitCode } = runBin(['completely-unknown-command-xyz']);
        (0, vitest_1.expect)(exitCode).not.toBe(0);
    }, 30_000);
});
//# sourceMappingURL=install-smoke.test.js.map