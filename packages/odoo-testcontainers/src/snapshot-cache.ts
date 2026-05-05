import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { StartedTestContainer } from 'testcontainers';
import type { AddonsMount } from './odoo-container';

const SNAPSHOT_SCHEMA_VERSION = 1;
const CACHE_CONTAINER_DIR = '/snapshot-cache';

export interface SnapshotCacheOptions {
  /** Enable snapshot restore/save. Defaults to true. */
  enabled?: boolean;
  /** Extra caller-owned cache discriminator for manual invalidation. */
  key?: string;
  /** Host cache directory. Defaults to .odoo-testcontainers/snapshots under cwd. */
  cacheDir?: string;
}

export interface SnapshotCache {
  enabled: boolean;
  key: string;
  cacheDir: string;
  fileName: string;
  hostPath: string;
  containerPath: string;
}

interface SnapshotKeyInput {
  odooVersion: string;
  postgresImage: string;
  modules: string[];
  addonsPath?: string | AddonsMount[];
  database: string;
  adminPassword: string;
  env: Record<string, string>;
  userKey?: string;
}

export function createSnapshotCache(
  options: boolean | SnapshotCacheOptions | undefined,
  input: SnapshotKeyInput
): SnapshotCache {
  const normalizedOptions: SnapshotCacheOptions =
    typeof options === 'object' ? options : { enabled: options };

  const envEnabled = process.env.ODOO_TESTCONTAINERS_SNAPSHOT !== 'disabled';
  const enabled = normalizedOptions.enabled ?? envEnabled;
  const cacheDir = path.resolve(
    normalizedOptions.cacheDir ??
      process.env.ODOO_TESTCONTAINERS_SNAPSHOT_DIR ??
      path.join(process.cwd(), '.odoo-testcontainers', 'snapshots')
  );
  const key = computeSnapshotKey({ ...input, userKey: normalizedOptions.key });
  const fileName = `${key}.dump`;

  return {
    enabled,
    key,
    cacheDir,
    fileName,
    hostPath: path.join(cacheDir, fileName),
    containerPath: `${CACHE_CONTAINER_DIR}/${fileName}`,
  };
}

export function hasSnapshot(cache: SnapshotCache): boolean {
  return cache.enabled && fs.existsSync(cache.hostPath);
}

export function ensureSnapshotDir(cache: SnapshotCache): void {
  if (!cache.enabled) return;
  fs.mkdirSync(cache.cacheDir, { recursive: true });
}

export function snapshotBindMount(cache: SnapshotCache): { source: string; target: string }[] {
  return cache.enabled ? [{ source: cache.cacheDir, target: CACHE_CONTAINER_DIR }] : [];
}

export async function restoreSnapshot(
  postgresContainer: StartedTestContainer,
  cache: SnapshotCache,
  database: string,
  username: string
): Promise<void> {
  const dropResult = await postgresContainer.exec(['dropdb', '-U', username, database]);
  if (dropResult.exitCode !== 0) {
    throw new Error(
      `Failed to prepare Odoo snapshot restore ${cache.key}: ${
        dropResult.stderr || dropResult.stdout
      }`
    );
  }

  const createResult = await postgresContainer.exec(['createdb', '-U', username, database]);
  if (createResult.exitCode !== 0) {
    throw new Error(
      `Failed to create Odoo snapshot database ${cache.key}: ${
        createResult.stderr || createResult.stdout
      }`
    );
  }

  const result = await postgresContainer.exec([
    'pg_restore',
    '-U',
    username,
    '-d',
    database,
    '--no-owner',
    '--role',
    username,
    cache.containerPath,
  ]);

  if (result.exitCode !== 0) {
    throw new Error(
      `Failed to restore Odoo snapshot ${cache.key}: ${result.stderr || result.stdout}`
    );
  }
}

export async function saveSnapshot(
  postgresContainer: StartedTestContainer,
  cache: SnapshotCache,
  database: string,
  username: string
): Promise<void> {
  if (!cache.enabled || fs.existsSync(cache.hostPath)) return;

  ensureSnapshotDir(cache);
  const tmpContainerPath = `${cache.containerPath}.tmp`;
  const result = await postgresContainer.exec([
    'pg_dump',
    '-U',
    username,
    '-d',
    database,
    '-Fc',
    '-f',
    tmpContainerPath,
  ]);

  if (result.exitCode !== 0) {
    try {
      fs.rmSync(`${cache.hostPath}.tmp`, { force: true });
    } catch {
      /* best-effort */
    }
    throw new Error(`Failed to save Odoo snapshot ${cache.key}: ${result.stderr || result.stdout}`);
  }

  fs.renameSync(`${cache.hostPath}.tmp`, cache.hostPath);
}

function computeSnapshotKey(input: SnapshotKeyInput): string {
  const hash = crypto.createHash('sha256');
  hash.update(
    stableStringify({
      schema: SNAPSHOT_SCHEMA_VERSION,
      odooVersion: input.odooVersion,
      postgresImage: input.postgresImage,
      modules: [...new Set(input.modules)].sort(),
      addons: hashAddonsPath(input.addonsPath),
      database: input.database,
      adminPassword: input.adminPassword,
      env: sortObject(input.env),
      userKey: input.userKey ?? '',
    })
  );
  return hash.digest('hex').slice(0, 16);
}

function hashAddonsPath(addonsPath: string | AddonsMount[] | undefined): unknown {
  if (!addonsPath) return null;

  const mounts =
    typeof addonsPath === 'string'
      ? [{ source: addonsPath, target: '/mnt/extra-addons', mode: 'ro' }]
      : addonsPath.map((mount, index) => ({
          source: mount.source,
          target: mount.target ?? `/mnt/addons-${index}`,
          mode: mount.mode ?? 'ro',
        }));

  return mounts.map((mount) => ({
    ...mount,
    source: path.resolve(mount.source),
    tree: hashPath(path.resolve(mount.source)),
  }));
}

function hashPath(sourcePath: string): unknown {
  if (!fs.existsSync(sourcePath)) {
    return { exists: false };
  }

  const stat = fs.statSync(sourcePath);
  if (stat.isFile()) {
    return { exists: true, type: 'file', digest: hashFile(sourcePath) };
  }

  if (!stat.isDirectory()) {
    return { exists: true, type: 'other', mtimeMs: Math.trunc(stat.mtimeMs), size: stat.size };
  }

  return {
    exists: true,
    type: 'directory',
    files: listFiles(sourcePath).map((file) => ({
      path: path.relative(sourcePath, file).replace(/\\/g, '/'),
      digest: hashFile(file),
    })),
  };
}

function listFiles(root: string): string[] {
  const ignored = new Set(['.git', 'node_modules', '__pycache__', '.pytest_cache']);
  const result: string[] = [];

  function walk(current: string): void {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      if (ignored.has(entry.name)) continue;
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.isFile()) {
        result.push(fullPath);
      }
    }
  }

  walk(root);
  return result.sort();
}

function hashFile(filePath: string): string {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function sortObject(value: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)));
}

function stableStringify(value: unknown): string {
  return JSON.stringify(value);
}
