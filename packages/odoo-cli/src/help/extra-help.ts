/**
 * --help-extra resolver and renderer.
 *
 * When --help-extra is passed, renders skill documentation for the command group.
 *
 * Strategy (hybrid):
 * 1. Runtime primary: if skills/ directory is accessible, read and render full markdown.
 * 2. Runtime fallback: use the built-in summary strings (works in compiled binaries).
 *
 * Skill map: command group → relevant skill files.
 */

import debug from 'debug';
import { existsSync, readFileSync } from 'fs';
import { join, resolve } from 'path';

const log = debug('odoo-cli:help');

const HELP_EXTRA_SKILLS: Record<string, string[]> = {
  records: ['base/crud.md', 'base/search.md', 'base/domains.md', 'base/field-types.md'],
  mail: ['mail/chatter.md'],
  modules: ['base/modules.md'],
  attendance: ['modules/timesheets.md'], // attendance is in hr module docs
  timesheets: ['modules/timesheets.md'],
  accounting: ['modules/accounting.md'],
  url: ['base/connection.md'],
  schema: ['base/introspection.md'],
  state: [],
  config: ['base/connection.md'],
};

const HELP_SUMMARIES: Record<string, string> = {
  records: `
## odoo records — Generic CRUD on any Odoo model

Search, get, create, update, and delete records on ANY Odoo model.

### Examples

  odoo records search crm.lead --fields id,name,stage_id --limit 20
  odoo records get res.partner 42
  odoo records create res.partner --data '{"name":"Acme Corp"}' --confirm
  odoo records write crm.lead 42 --data '{"stage_id":5}' --confirm
  odoo records delete crm.lead 42 --confirm

### Domain syntax

  --domain '[("active","=",True),("stage_id.name","=","Won")]'
  --filter active=true --filter state=sale    (simple AND equality)
  --domain-file domain.json                   (from file)
  --domain-file -                             (from stdin)

Run 'odoo schema fields <model>' to discover available fields.
`,

  mail: `
## odoo mail — Chatter messages and internal notes

Post messages on any record's chatter.

  odoo mail note crm.lead 42 "Called customer" --confirm
  odoo mail post sale.order 88 "Order shipped" --confirm
  echo "Deployed: v1.2.3" | odoo mail note project.task 17 --message-file - --confirm

note: internal only (staff), post: public (notifies followers).
`,

  modules: `
## odoo modules — Install, upgrade, and list modules

  odoo modules list --filter installed
  odoo modules install hr_timesheet --confirm
  odoo modules upgrade sale_management --confirm
  odoo modules status sale_management     (exits 3 if not found)

Scripting pattern:
  if [ "$(odoo modules status sale)" = "installed" ]; then echo ready; fi
`,

  timesheets: `
## odoo timesheets — Time tracking

Timer workflow:
  odoo timesheets start --task-id 42 --description "Feature work" --confirm
  odoo timesheets stop --confirm
  odoo timesheets running

Manual logging:
  odoo timesheets log --task-id 42 --hours 1.5 --description "Review" --confirm
  odoo timesheets log --task-id 42 --hours 1:30 --confirm
`,

  attendance: `
## odoo attendance — Clock in/out

  odoo attendance clock-in --confirm
  odoo attendance clock-out --confirm
  odoo attendance status
  odoo attendance list --from 2024-03-11 --to 2024-03-15
`,

  accounting: `
## odoo accounting — Read-only accounting queries (no mutations)

  odoo accounting cash-accounts
  odoo accounting cash-balance --as-of 2024-03-31
  odoo accounting posted-moves --from 2024-01-01 --to 2024-03-31
  odoo accounting trace-recon 42
  odoo accounting days-to-pay 1042
`,

  schema: `
## odoo schema — Model and field introspection

  odoo schema models --search sale
  odoo schema fields crm.lead --type many2one
  odoo schema describe res.partner
  odoo schema codegen sale.order --out ./types/sale-order.ts
`,

  url: `
## odoo url — Generate record URLs

  odoo url record crm.lead 42
  odoo url portal sale.order 88
`,

  config: `
## odoo config — Connection management

  odoo config check     # verify credentials and show current user
  odoo config show      # show resolved config (password redacted)
`,

  state: `
## odoo state — State management ⚠ EXPERIMENTAL

Requires --experimental flag on all commands.

  odoo state plan ./crm-stages.json --experimental
  odoo state apply ./crm-stages.json --experimental --confirm

No extended docs available yet for this experimental feature.
`,
};

/**
 * Resolve the skills directory relative to this package or the monorepo root.
 */
function findSkillsDir(): string | null {
  // Try: relative to this file (dev install in monorepo)
  const candidates = [
    // monorepo: packages/odoo-cli → ../../skills/odoo
    resolve(__dirname, '..', '..', '..', '..', 'skills', 'odoo'),
    // npm install: alongside package
    resolve(__dirname, '..', 'skills', 'odoo'),
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      log('Found skills dir: %s', candidate);
      return candidate;
    }
  }

  log('Skills directory not found, using built-in summaries');
  return null;
}

/**
 * Show extended help for a command group.
 *
 * Writes to stdout (so it can be piped / paged).
 */
export async function showHelpExtra(group: string): Promise<void> {
  const skillFiles = HELP_EXTRA_SKILLS[group];

  if (skillFiles === undefined) {
    process.stdout.write(`No extended help available for '${group}'.\n`);
    return;
  }

  if (skillFiles.length === 0) {
    const summary = HELP_SUMMARIES[group];
    if (summary) {
      process.stdout.write(summary + '\n');
    } else {
      process.stdout.write(`No extended help available for '${group}'.\n`);
    }
    return;
  }

  // Try to read full markdown files
  const skillsDir = findSkillsDir();
  if (skillsDir) {
    let rendered = false;
    for (const file of skillFiles) {
      const fullPath = join(skillsDir, file);
      if (existsSync(fullPath)) {
        try {
          const content = readFileSync(fullPath, 'utf8');
          process.stdout.write(`\n${'─'.repeat(60)}\n`);
          process.stdout.write(`# Skill: ${file}\n`);
          process.stdout.write(`${'─'.repeat(60)}\n\n`);
          process.stdout.write(content + '\n');
          rendered = true;
        } catch (err) {
          log('Could not read %s: %o', fullPath, err);
        }
      }
    }
    if (rendered) return;
  }

  // Fallback: built-in summary
  const summary = HELP_SUMMARIES[group] ?? `No extended help available for '${group}'.`;
  process.stdout.write(summary + '\n');
}
