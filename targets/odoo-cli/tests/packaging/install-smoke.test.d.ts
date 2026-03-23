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
export {};
//# sourceMappingURL=install-smoke.test.d.ts.map
