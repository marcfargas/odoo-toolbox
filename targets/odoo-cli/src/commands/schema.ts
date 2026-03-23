/**
 * `odoo schema` command group — model and field introspection.
 *
 * Wraps @marcfargas/odoo-introspection.
 *
 * Commands:
 *   schema models               List all models [READ]
 *   schema fields <model>       List fields for a model [READ]
 *   schema describe <model>     Human-readable model summary [READ]
 *   schema codegen <model>      Generate TypeScript interface [READ]
 *
 * All commands are READ — no mutations.
 */

import { Command } from 'commander';
import debug from 'debug';
import { Introspector } from '@marcfargas/odoo-introspection';
import { createAuthClient, type AuthFlags } from '../middleware/auth';
import { addAuthOptions, addOutputOptions, formatOption } from '../middleware/common-params';
import { resolveFormat, render } from '../output/formatter';
import { handleError, EXIT_CODES } from '../output/errors';
import { writeStdout } from '../output/stream-writer';
import { showHelpExtra } from '../help/extra-help';

const log = debug('odoo-cli:schema');

export function buildSchemaCommand(): Command {
  const schema = new Command('schema')
    .description('Model and field introspection — discover Odoo schema at runtime')
    .addHelpText(
      'after',
      `
Safety: READ — no confirmation required.
Wraps @marcfargas/odoo-introspection.

Examples:
  odoo schema models --search sale
  odoo schema fields crm.lead --type many2one
  odoo schema describe res.partner
  odoo schema codegen sale.order --out ./types/sale-order.ts
`
    );

  // --help-extra
  schema.option('--help-extra', 'Show extended skill documentation for schema');
  schema.hook('preAction', async (thisCommand) => {
    const opts = thisCommand.opts();
    if (opts.helpExtra) {
      await showHelpExtra('schema');
      process.exit(0);
    }
  });

  schema.addCommand(buildModelsCommand());
  schema.addCommand(buildFieldsCommand());
  schema.addCommand(buildDescribeCommand());
  schema.addCommand(buildCodegenCommand());

  return schema;
}

function buildModelsCommand(): Command {
  const cmd = new Command('models').description('List all Odoo models [READ]').addHelpText(
    'after',
    `
Examples:
  odoo schema models
  odoo schema models --search sale
  odoo schema models --format json | jq '.[].model'
`
  );

  addAuthOptions(cmd);
  addOutputOptions(cmd);
  cmd.option('--search <text>', 'Substring filter on model name or description');
  cmd.option('--installed', 'Only models from installed modules (default: all)');

  cmd.action(async () => {
    const opts = cmd.optsWithGlobals() as AuthFlags & {
      search?: string;
      installed?: boolean;
      format?: string;
    };

    log('schema models search=%s', opts.search);

    let client;
    try {
      client = await createAuthClient(opts);
    } catch (err) {
      process.exit(handleError(err));
    }

    try {
      const introspector = new Introspector(client);
      let models = await introspector.getModels();

      if (opts.search) {
        const q = opts.search.toLowerCase();
        models = models.filter(
          (m) => m.model.toLowerCase().includes(q) || (m.name ?? '').toLowerCase().includes(q)
        );
      }

      const format = resolveFormat(opts.format);
      const rows = models.map((m) => ({
        model: m.model,
        description: m.name ?? '',
        modules: m.modules ?? '',
        transient: m.transient ? 'yes' : 'no',
      }));

      await render(rows, format);
    } catch (err) {
      process.exit(handleError(err));
    } finally {
      client?.logout();
    }
  });

  return cmd;
}

function buildFieldsCommand(): Command {
  const cmd = new Command('fields')
    .description('List fields for a model [READ]')
    .argument('<model>', 'Odoo model name (e.g., crm.lead)')
    .addHelpText(
      'after',
      `
Examples:
  odoo schema fields crm.lead
  odoo schema fields crm.lead --type many2one
  odoo schema fields res.partner --required --format csv
`
    );

  addAuthOptions(cmd);
  addOutputOptions(cmd);
  cmd.option('--search <text>', 'Filter by field name substring');
  cmd.option('--type <type>', 'Filter by field type (char, many2one, integer, etc.)');
  cmd.option('--required', 'Show only required fields');

  cmd.action(async (model: string) => {
    const opts = cmd.optsWithGlobals() as AuthFlags & {
      search?: string;
      type?: string;
      required?: boolean;
      format?: string;
    };

    log('schema fields %s type=%s required=%s', model, opts.type, opts.required);

    let client;
    try {
      client = await createAuthClient(opts);
    } catch (err) {
      process.exit(handleError(err));
    }

    try {
      const introspector = new Introspector(client);
      let fields = await introspector.getFields(model);

      if (opts.search) {
        const q = opts.search.toLowerCase();
        fields = fields.filter((f) => f.name.toLowerCase().includes(q));
      }

      if (opts.type) {
        fields = fields.filter((f) => f.ttype === opts.type);
      }

      if (opts.required) {
        fields = fields.filter((f) => f.required);
      }

      const format = resolveFormat(opts.format);
      const rows = fields.map((f) => ({
        field: f.name,
        type: f.ttype,
        string: f.field_description ?? '',
        required: f.required ? 'yes' : 'no',
        readonly: f.readonly ? 'yes' : 'no',
        relation: f.relation ?? '',
      }));

      await render(rows, format);
    } catch (err) {
      if (err instanceof Error && err.message.includes('not found')) {
        process.stderr.write(
          `✗ Error: Model '${model}' not found\n  → Run: odoo schema models --search ${model.split('.')[0]}\n`
        );
        process.exit(EXIT_CODES.NOT_FOUND);
      }
      process.exit(handleError(err));
    } finally {
      client?.logout();
    }
  });

  return cmd;
}

function buildDescribeCommand(): Command {
  const cmd = new Command('describe')
    .description('Human-readable model summary [READ]')
    .argument('<model>', 'Odoo model name')
    .addHelpText(
      'after',
      `
Examples:
  odoo schema describe res.partner
  odoo schema describe crm.lead
`
    );

  addAuthOptions(cmd);
  cmd.addOption(formatOption());

  cmd.action(async (model: string) => {
    const opts = cmd.optsWithGlobals() as AuthFlags & { format?: string };

    log('schema describe %s', model);

    let client;
    try {
      client = await createAuthClient(opts);
    } catch (err) {
      process.exit(handleError(err));
    }

    try {
      const introspector = new Introspector(client);
      const metadata = await introspector.getModelMetadata(model);
      const format = resolveFormat(opts.format);

      // Build field type summary
      const typeCounts: Record<string, number> = {};
      for (const f of metadata.fields) {
        typeCounts[f.ttype] = (typeCounts[f.ttype] ?? 0) + 1;
      }

      const requiredCount = metadata.fields.filter((f) => f.required).length;
      const readonlyCount = metadata.fields.filter((f) => f.readonly).length;
      const relationalCount = metadata.fields.filter((f) =>
        ['many2one', 'one2many', 'many2many'].includes(f.ttype)
      ).length;

      if (format === 'json' || format === 'ndjson') {
        const out = {
          model: metadata.model.model,
          name: metadata.model.name,
          modules: metadata.model.modules,
          info: metadata.model.info,
          field_count: metadata.fields.length,
          required_count: requiredCount,
          readonly_count: readonlyCount,
          relational_count: relationalCount,
          field_types: typeCounts,
        };
        await writeStdout(JSON.stringify(out, null, format === 'json' ? 2 : 0) + '\n');
      } else {
        process.stdout.write(`\n${metadata.model.name} (${model})\n`);
        process.stdout.write(`${'─'.repeat(60)}\n`);
        if (metadata.model.info) {
          process.stdout.write(`${metadata.model.info}\n\n`);
        }
        process.stdout.write(`Total fields:      ${metadata.fields.length}\n`);
        process.stdout.write(`Required:          ${requiredCount}\n`);
        process.stdout.write(`Readonly/computed: ${readonlyCount}\n`);
        process.stdout.write(`Relational:        ${relationalCount}\n`);
        process.stdout.write(`Modules:           ${metadata.model.modules ?? ''}\n`);
        process.stdout.write(`\nField types:\n`);
        for (const [type, count] of Object.entries(typeCounts).sort(([, a], [, b]) => b - a)) {
          process.stdout.write(`  ${type.padEnd(12)} ${count}\n`);
        }
        process.stdout.write(`\nRun 'odoo schema fields ${model}' to see all fields.\n`);
      }
    } catch (err) {
      if (err instanceof Error && err.message.includes('not found')) {
        process.stderr.write(`✗ Error: Model '${model}' not found\n`);
        process.exit(EXIT_CODES.NOT_FOUND);
      }
      process.exit(handleError(err));
    } finally {
      client?.logout();
    }
  });

  return cmd;
}

function buildCodegenCommand(): Command {
  const cmd = new Command('codegen')
    .description('Generate TypeScript interface from live schema [READ]')
    .argument('<model>', 'Odoo model name')
    .addHelpText(
      'after',
      `
Generates a TypeScript interface from the live Odoo schema.

Examples:
  odoo schema codegen sale.order
  odoo schema codegen sale.order --out ./types/sale-order.ts
  odoo schema codegen crm.lead --readonly
`
    );

  addAuthOptions(cmd);
  cmd.option('--out <file>', 'Write to file (default: stdout)');
  cmd.option('--readonly', 'Mark computed/readonly fields as readonly in TypeScript');

  cmd.action(async (model: string) => {
    const opts = cmd.optsWithGlobals() as AuthFlags & {
      out?: string;
      readonly?: boolean;
    };

    log('schema codegen %s', model);

    let client;
    try {
      client = await createAuthClient(opts);
    } catch (err) {
      process.exit(handleError(err));
    }

    try {
      const introspector = new Introspector(client);
      const metadata = await introspector.getModelMetadata(model);

      // Generate TypeScript interface
      const lines: string[] = [];
      const interfaceName = modelToInterfaceName(model);

      lines.push(`/**`);
      lines.push(` * TypeScript interface for Odoo model: ${model}`);
      lines.push(` * Generated from live schema by odoo-cli schema codegen`);
      lines.push(` * Name: ${metadata.model.name}`);
      lines.push(` */`);
      lines.push(`export interface ${interfaceName} {`);

      for (const field of metadata.fields) {
        const tsType = mapFieldType(field.ttype, field.relation);
        const readonlyMod = opts.readonly && field.readonly ? 'readonly ' : '';
        const optionalMod = field.required ? '' : '?';
        const comment = field.field_description ?? field.name;

        lines.push(`  /** ${comment}${field.help ? ` — ${field.help}` : ''} */`);
        lines.push(`  ${readonlyMod}${field.name}${optionalMod}: ${tsType};`);
      }

      lines.push(`}`);
      lines.push(``);

      const output = lines.join('\n');

      if (opts.out) {
        const { writeFileSync } = await import('fs');
        writeFileSync(opts.out, output, 'utf8');
        process.stderr.write(`✓ Written to ${opts.out}\n`);
      } else {
        await writeStdout(output);
      }
    } catch (err) {
      if (err instanceof Error && err.message.includes('not found')) {
        process.stderr.write(`✗ Error: Model '${model}' not found\n`);
        process.exit(EXIT_CODES.NOT_FOUND);
      }
      process.exit(handleError(err));
    } finally {
      client?.logout();
    }
  });

  return cmd;
}

// ── Helpers ──────────────────────────────────────────────────────────

function modelToInterfaceName(model: string): string {
  return model
    .split('.')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}

function mapFieldType(ttype: string, _relation?: string): string {
  switch (ttype) {
    case 'char':
    case 'text':
    case 'html':
    case 'date':
    case 'datetime':
    case 'selection':
    case 'binary':
    case 'reference':
      return 'string';
    case 'integer':
      return 'number';
    case 'float':
    case 'monetary':
      return 'number';
    case 'boolean':
      return 'boolean';
    case 'many2one':
      return '[number, string] | false';
    case 'one2many':
    case 'many2many':
      return 'number[]';
    default:
      return 'unknown';
  }
}
