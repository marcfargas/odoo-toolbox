/**
 * Output formatter for odoo-cli.
 *
 * Formats: json | table | csv | ndjson
 *
 * Conventions:
 * - stdout = data only (all formats write to stdout)
 * - stderr = decorative messages, warnings (caller's responsibility)
 * - Many2one fields [id, name]: expanded to two columns in table/csv
 * - table warns above 5000 rows and suggests ndjson
 * - ndjson: streams one JSON object per line
 */

import Table from 'cli-table3';
import debug from 'debug';
import { writeStdout, toCsvRow } from './stream-writer';
import { printWarning } from './errors';

const log = debug('odoo-cli:formatter');

export type OutputFormat = 'json' | 'table' | 'csv' | 'ndjson';

// ── Global output flags ───────────────────────────────────────────────

let _noColor = false;
let _quiet = false;

/** Disable ANSI colors in table/CLI output. Called from cli.ts preAction hook. */
export function setNoColor(v: boolean): void {
  _noColor = v;
}

/** Suppress stderr progress and warnings. Called from cli.ts preAction hook. */
export function setQuiet(v: boolean): void {
  _quiet = v;
}

/** Whether quiet mode is active (used by other output modules). */
export function isQuiet(): boolean {
  return _quiet;
}

/** Whether no-color mode is active. */
export function isNoColor(): boolean {
  return _noColor || process.env.NO_COLOR !== undefined;
}

/**
 * Detect the default output format.
 * TTY → table, pipe → json.
 */
export function detectFormat(): OutputFormat {
  return process.stdout.isTTY ? 'table' : 'json';
}

/**
 * Resolve the format from option string, falling back to auto-detect.
 */
export function resolveFormat(fmt: string | undefined): OutputFormat {
  if (!fmt) return detectFormat();
  if (fmt === 'json' || fmt === 'table' || fmt === 'csv' || fmt === 'ndjson') return fmt;
  // invalid, fall back
  return detectFormat();
}

// ── Many2one handling ─────────────────────────────────────────────────

/**
 * Check if a value looks like a many2one tuple: [number, string] | false.
 */
function isMany2one(value: unknown): value is [number, string] | false {
  if (value === false) return true;
  if (Array.isArray(value) && value.length === 2 && typeof value[0] === 'number') return true;
  return false;
}

/**
 * Flatten many2one fields for table/csv output.
 *
 * Input record:  { id: 1, partner_id: [7, "Marc"] }
 * Output record: { id: 1, partner_id: 7, partner_id_name: "Marc" }
 *
 * For boolean false (no relation): partner_id → null, partner_id_name → ""
 */
export function flattenRecord(record: Record<string, any>): Record<string, any> {
  const out: Record<string, any> = {};
  for (const [key, val] of Object.entries(record)) {
    if (isMany2one(val)) {
      if (val === false) {
        out[key] = null;
        out[`${key}_name`] = '';
      } else {
        out[key] = val[0];
        out[`${key}_name`] = val[1];
      }
    } else {
      out[key] = val;
    }
  }
  return out;
}

/**
 * Get column headers for a set of records, expanding many2one fields.
 */
export function getColumns(records: Record<string, any>[]): string[] {
  if (records.length === 0) return [];
  const first = records[0];
  const cols: string[] = [];
  for (const [key, val] of Object.entries(first)) {
    if (isMany2one(val)) {
      cols.push(key);
      cols.push(`${key}_name`);
    } else {
      cols.push(key);
    }
  }
  return cols;
}

// ── Format renderers ─────────────────────────────────────────────────

/**
 * Write JSON array to stdout.
 */
export async function formatJson(records: Record<string, any>[]): Promise<void> {
  log('Formatting %d records as json', records.length);
  await writeStdout(JSON.stringify(records, null, 2) + '\n');
}

/**
 * Write ndjson to stdout — one JSON object per line.
 */
export async function formatNdjson(records: Record<string, any>[]): Promise<void> {
  log('Formatting %d records as ndjson', records.length);
  for (const record of records) {
    await writeStdout(JSON.stringify(record) + '\n');
  }
}

/**
 * Write table to stdout.
 * Warns at >5000 rows and suggests --format ndjson.
 */
export async function formatTable(records: Record<string, any>[]): Promise<void> {
  log('Formatting %d records as table', records.length);

  if (records.length === 0) {
    process.stderr.write('(no records)\n');
    return;
  }

  if (records.length > 5000) {
    printWarning(
      `${records.length} rows is large for table format — consider --format ndjson for streaming output`
    );
  }

  const flattened = records.map(flattenRecord);
  const cols = getColumns(records);

  const table = new Table({
    head: cols.map((c) => c.toUpperCase()),
    style: { head: isNoColor() ? [] : ['cyan'] },
    wordWrap: false,
  });

  for (const rec of flattened) {
    table.push(cols.map((col) => formatCell(rec[col])));
  }

  await writeStdout(table.toString() + '\n');
}

/**
 * Write CSV to stdout.
 * Expands many2one fields to two columns.
 */
export async function formatCsv(records: Record<string, any>[]): Promise<void> {
  log('Formatting %d records as csv', records.length);

  if (records.length === 0) return;

  const cols = getColumns(records);
  // Header
  await writeStdout(toCsvRow(cols) + '\n');

  for (const record of records) {
    const flat = flattenRecord(record);
    await writeStdout(toCsvRow(cols.map((c) => flat[c] ?? '')) + '\n');
  }
}

/**
 * Format a single cell value for table display.
 */
function formatCell(value: unknown): string {
  if (value === null || value === undefined || value === false) return '';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (Array.isArray(value)) return JSON.stringify(value);
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

/**
 * Master render function — routes to the appropriate formatter.
 */
export async function render(records: Record<string, any>[], format: OutputFormat): Promise<void> {
  switch (format) {
    case 'json':
      return formatJson(records);
    case 'ndjson':
      return formatNdjson(records);
    case 'csv':
      return formatCsv(records);
    case 'table':
    default:
      return formatTable(records);
  }
}

/**
 * Render a single record (e.g., `records get`).
 * JSON outputs an object (not array). Table shows key/value pairs.
 */
export async function renderSingle(
  record: Record<string, any>,
  format: OutputFormat
): Promise<void> {
  if (format === 'json') {
    await writeStdout(JSON.stringify(record, null, 2) + '\n');
    return;
  }
  if (format === 'ndjson') {
    await writeStdout(JSON.stringify(record) + '\n');
    return;
  }
  if (format === 'csv') {
    // Single record as CSV
    await formatCsv([record]);
    return;
  }
  // table: key/value layout
  const flat = flattenRecord(record);
  const table = new Table({
    style: { head: ['cyan'] },
  });
  for (const [key, val] of Object.entries(flat)) {
    table.push({ [key]: formatCell(val) });
  }
  await writeStdout(table.toString() + '\n');
}

/**
 * Render a simple key/value config-style object (for `config show`).
 */
export async function renderKeyValue(
  data: Record<string, string>,
  format: OutputFormat
): Promise<void> {
  if (format === 'json' || format === 'ndjson') {
    await writeStdout(JSON.stringify(data, null, format === 'json' ? 2 : 0) + '\n');
    return;
  }
  if (format === 'csv') {
    await writeStdout(toCsvRow(['key', 'value']) + '\n');
    for (const [k, v] of Object.entries(data)) {
      await writeStdout(toCsvRow([k, v]) + '\n');
    }
    return;
  }
  // table
  const table = new Table({ style: { head: ['cyan'] } });
  for (const [k, v] of Object.entries(data)) {
    table.push({ [k]: v });
  }
  await writeStdout(table.toString() + '\n');
}

/**
 * Paged search-read generator — fetches from Odoo in pages.
 * Used by `records search --all`.
 */
export async function* pagedSearchRead(
  searchFn: (offset: number, limit: number) => Promise<Record<string, any>[]>,
  pageSize: number = 500
): AsyncGenerator<Record<string, any>[]> {
  for (let offset = 0; ; offset += pageSize) {
    const rows = await searchFn(offset, pageSize);
    if (rows.length === 0) break;
    yield rows;
    if (rows.length < pageSize) break;
  }
}
