/**
 * Seed image resolution utilities.
 *
 * Determines whether the pre-seeded Postgres image (ODOO_SEED_IMAGE) covers
 * the modules requested by a test, enabling fast DB restore (~15s) instead of
 * a cold Odoo --init run (~3min).
 *
 * Extracted as a separate module so the logic can be unit-tested independently
 * of the container lifecycle.
 */

import * as fs from 'fs';
import * as path from 'path';

export interface SeedVersionConfig {
  modules: string[];
}

export interface SeedConfig {
  postgresImage: string;
  versions: Record<string, SeedVersionConfig>;
}

export interface SeedInfo {
  seedImage: string;
  seedModules: string[];
}

/**
 * Read seed-config.json from known locations relative to CWD.
 * Returns null if not found (graceful degradation to cold start).
 *
 * Search order:
 *  1. <cwd>/docker/seed-config.json        (running from monorepo root)
 *  2. <cwd>/../../docker/seed-config.json  (running from a package dir)
 */
export function readSeedConfig(cwd: string = process.cwd()): SeedConfig | null {
  const candidatePaths = [
    path.join(cwd, 'docker', 'seed-config.json'),
    path.join(cwd, '..', '..', 'docker', 'seed-config.json'),
  ];

  for (const p of candidatePaths) {
    try {
      return JSON.parse(fs.readFileSync(p, 'utf8')) as SeedConfig;
    } catch {
      // not found at this path — try next
    }
  }

  return null;
}

/**
 * Determine whether a seed image can be used for the requested modules.
 *
 * Returns SeedInfo if:
 *   1. ODOO_SEED_IMAGE env var is set
 *   2. seed-config.json is found and readable
 *   3. The seed covers all requested modules (seedModules ⊇ requestedModules)
 *
 * Returns null to trigger cold start.
 *
 * @param requestedModules - Modules the test wants installed
 * @param odooVersion      - Full version string (e.g. '17.0')
 * @param seedImageEnv     - Override for ODOO_SEED_IMAGE (defaults to process.env)
 * @param cwd              - Override for config search root (defaults to process.cwd())
 */
export function resolveSeedInfo(
  requestedModules: string[],
  odooVersion: string,
  seedImageEnv: string | undefined = process.env.ODOO_SEED_IMAGE,
  cwd: string = process.cwd()
): SeedInfo | null {
  if (!seedImageEnv) return null;

  const config = readSeedConfig(cwd);
  if (!config) {
    return null; // caller logs warning
  }

  const versionConfig = config.versions?.[odooVersion];
  if (!versionConfig?.modules) {
    return null; // caller logs warning
  }

  const seedModules = versionConfig.modules;

  // Superset check: all requested modules must be present in the seed.
  // Requesting fewer modules than the seed has is fine (e.g., ['base']
  // when seed has ['base','mail','crm'] → still a hit).
  const uncovered = requestedModules.filter((m) => !seedModules.includes(m));
  if (uncovered.length > 0) {
    return null; // caller logs miss info
  }

  return { seedImage: seedImageEnv, seedModules };
}

/**
 * Normalise a raw ODOO_VERSION value into the full dotted form.
 *
 * @example
 *   normaliseOdooVersion('17')   → '17.0'
 *   normaliseOdooVersion('17.0') → '17.0'
 *   normaliseOdooVersion('18')   → '18.0'
 */
export function normaliseOdooVersion(raw: string | undefined): string {
  if (!raw) return '17.0';
  // Already has a dot → use as-is
  if (raw.includes('.')) return raw;
  return `${raw}.0`;
}
