import { appendFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import debug from 'debug';

const log = debug('odoo-mcp:audit');

export interface AuditEntry {
  ts: string;
  tool: string;
  model?: string;
  ids?: number[];
  fields?: string[];
  odoo_user?: string;
  client_ip?: string | null;
  transport: 'http' | 'stdio';
}

export class AuditWriter {
  private dirReady = false;

  constructor(private readonly filePath?: string) {}

  get enabled(): boolean {
    return Boolean(this.filePath);
  }

  async log(entry: Omit<AuditEntry, 'ts'>): Promise<void> {
    if (!this.filePath) {
      return;
    }

    try {
      if (!this.dirReady) {
        await mkdir(dirname(this.filePath), { recursive: true });
        this.dirReady = true;
      }

      const line = `${JSON.stringify({ ts: new Date().toISOString(), ...entry })}\n`;
      await appendFile(this.filePath, line, 'utf8');
    } catch (error) {
      log('Failed to write audit line: %o', error);
    }
  }
}
