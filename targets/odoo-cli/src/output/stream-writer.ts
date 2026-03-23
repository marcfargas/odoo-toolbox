/**
 * Backpressure-safe incremental stdout writer.
 *
 * Used for streaming ndjson and csv output of large result sets
 * without buffering everything in memory.
 */

import { Writable } from 'stream';

/**
 * Write a string to stdout, handling backpressure.
 *
 * Returns a promise that resolves when the data has been flushed
 * or the stream has drained.
 */
export function writeStdout(data: string): Promise<void> {
  return writeToStream(process.stdout, data);
}

function writeToStream(stream: Writable, data: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const ok = stream.write(data, 'utf8', (err) => {
      if (err) reject(err);
    });
    if (ok) {
      resolve();
    } else {
      stream.once('drain', resolve);
      stream.once('error', reject);
    }
  });
}

/**
 * Stream ndjson records — one JSON object per line.
 * Memory-efficient for large result sets.
 */
export async function streamNdjson(records: Record<string, any>[]): Promise<void> {
  for (const record of records) {
    await writeStdout(JSON.stringify(record) + '\n');
  }
}

/**
 * Stream CSV rows incrementally.
 * Caller is responsible for writing the header first.
 */
export async function streamCsvRows(rows: string[][], separator: string = ','): Promise<void> {
  for (const row of rows) {
    await writeStdout(toCsvRow(row, separator) + '\n');
  }
}

/**
 * Escape a single CSV cell value.
 * Wraps in quotes if the value contains comma, quote, or newline.
 */
export function toCsvCell(value: unknown): string {
  const str = value === null || value === undefined ? '' : String(value);
  // Must quote if contains delimiter, quote, or newlines
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

/**
 * Format a row of values as a CSV line (no trailing newline).
 */
export function toCsvRow(cells: unknown[], separator: string = ','): string {
  return cells.map(toCsvCell).join(separator);
}
