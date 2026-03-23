/**
 * Robust JSON parsing helpers with actionable error messages.
 *
 * Used for --data, --kwargs, --args, --context flags.
 */

import debug from 'debug';
import { readFileSync } from 'fs';

const log = debug('odoo-cli:json-arg');

export class JsonArgError extends Error {
  constructor(
    message: string,
    public readonly source: string,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'JsonArgError';
  }
}

/**
 * Parse a JSON string argument with a helpful error message.
 *
 * @param raw   - Raw string from CLI flag
 * @param flag  - Flag name for error context (e.g., '--data')
 */
export function parseJsonArg(raw: string, flag: string = '--data'): Record<string, any> {
  log('Parsing JSON arg for %s: %s', flag, raw);
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      throw new JsonArgError(
        `${flag} must be a JSON object (got ${Array.isArray(parsed) ? 'array' : typeof parsed})`,
        raw
      );
    }
    return parsed;
  } catch (err) {
    if (err instanceof JsonArgError) throw err;
    const syntaxErr = err instanceof SyntaxError ? err : undefined;
    throw new JsonArgError(
      `Invalid JSON for ${flag}: ${syntaxErr?.message ?? String(err)}\n  Got: ${raw.slice(0, 200)}`,
      raw,
      syntaxErr
    );
  }
}

/**
 * Parse a JSON array argument.
 *
 * @param raw   - Raw string from CLI flag
 * @param flag  - Flag name for error context (e.g., '--args')
 */
export function parseJsonArray(raw: string, flag: string = '--args'): any[] {
  log('Parsing JSON array arg for %s: %s', flag, raw);
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      throw new JsonArgError(`${flag} must be a JSON array (got ${typeof parsed})`, raw);
    }
    return parsed;
  } catch (err) {
    if (err instanceof JsonArgError) throw err;
    const syntaxErr = err instanceof SyntaxError ? err : undefined;
    throw new JsonArgError(
      `Invalid JSON array for ${flag}: ${syntaxErr?.message ?? String(err)}\n  Got: ${raw.slice(0, 200)}`,
      raw,
      syntaxErr
    );
  }
}

/**
 * Read JSON from a file path, or stdin when filePath is '-'.
 *
 * @param filePath - File path or '-' for stdin
 * @param flag     - Flag name for error context
 */
export async function readJsonFile(
  filePath: string,
  flag: string = '--data-file'
): Promise<Record<string, any>> {
  let content: string;

  if (filePath === '-') {
    content = await readStdin();
  } else {
    try {
      content = readFileSync(filePath, 'utf8');
    } catch (err) {
      throw new JsonArgError(
        `Cannot read ${flag} from '${filePath}': ${err instanceof Error ? err.message : String(err)}`,
        filePath
      );
    }
  }

  return parseJsonArg(content.trim(), flag);
}

/**
 * Read stdin as a string.
 */
export function readStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    if (process.stdin.isTTY) {
      resolve('');
      return;
    }
    const chunks: Buffer[] = [];
    process.stdin.on('data', (chunk) => chunks.push(chunk));
    process.stdin.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    process.stdin.on('error', reject);
  });
}

/**
 * Read a text message from a file or stdin.
 */
export async function readMessageFile(filePath: string): Promise<string> {
  if (filePath === '-') {
    return readStdin();
  }
  try {
    return readFileSync(filePath, 'utf8');
  } catch (err) {
    throw new JsonArgError(
      `Cannot read message from '${filePath}': ${err instanceof Error ? err.message : String(err)}`,
      filePath
    );
  }
}

/**
 * Parse hours from "1.5" or "1:30" format.
 */
export function parseHours(raw: string): number {
  const trimmed = raw.trim();
  if (trimmed.includes(':')) {
    const parts = trimmed.split(':');
    if (parts.length !== 2) {
      throw new JsonArgError(`Invalid hours format '${raw}': use H:MM or decimal`, raw);
    }
    const h = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    if (isNaN(h) || isNaN(m) || m < 0 || m >= 60) {
      throw new JsonArgError(`Invalid hours format '${raw}': minutes must be 0-59`, raw);
    }
    return h + m / 60;
  }
  const n = parseFloat(trimmed);
  if (isNaN(n) || n < 0) {
    throw new JsonArgError(`Invalid hours value '${raw}': must be a positive number`, raw);
  }
  return n;
}

/**
 * Parse comma-separated IDs into an array of numbers.
 */
export function parseIds(raw: string): number[] {
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => {
      const n = parseInt(s, 10);
      if (isNaN(n)) throw new JsonArgError(`Invalid ID '${s}': must be a positive integer`, raw);
      return n;
    });
}
