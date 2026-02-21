/**
 * `odoo mail` command group — chatter messages and internal notes.
 *
 * Commands:
 *   mail note <model> <id> [message]    Post internal note [WRITE]
 *   mail post <model> <id> [message]    Post public message [WRITE]
 *
 * Both commands require --confirm.
 */

import { Command } from 'commander';
import debug from 'debug';
import { createAuthClient, type AuthFlags } from '../middleware/auth';
import { requireConfirm, printDryRun } from '../middleware/safety';
import { addAuthOptions, confirmOption, dryRunOption } from '../middleware/common-params';
import { handleError, printSuccess, EXIT_CODES } from '../output/errors';
import { readMessageFile } from '../parsing/json-arg';
import { parseIds } from '../parsing/json-arg';
import { showHelpExtra } from '../help/extra-help';

const log = debug('odoo-cli:mail');

export function buildMailCommand(): Command {
  const mail = new Command('mail')
    .description('Post messages and notes on Odoo record chatters')
    .addHelpText(
      'after',
      `
Safety: WRITE — requires --confirm.
note: internal only (staff, no email).  post: public (notifies followers).

Examples:
  odoo mail note crm.lead 42 "Called customer" --confirm
  odoo mail post sale.order 88 "Your order shipped" --confirm
  echo "CI passed" | odoo mail note project.task 17 --message-file - --confirm
  odoo mail note crm.lead 42 --html --subject "Contract" --message-file contract.html --confirm
`
    );

  // --help-extra
  mail.option('--help-extra', 'Show extended skill documentation for mail');
  mail.hook('preAction', async (thisCommand) => {
    const opts = thisCommand.opts();
    if (opts.helpExtra) {
      await showHelpExtra('mail');
      process.exit(0);
    }
  });

  mail.addCommand(buildNoteCommand());
  mail.addCommand(buildPostCommand());

  return mail;
}

function buildMailSubCommand(name: 'note' | 'post'): Command {
  const isNote = name === 'note';
  const cmd = new Command(name)
    .description(
      isNote
        ? 'Post an internal note (staff only, no email notification) [WRITE — requires --confirm]'
        : 'Post a public message (visible to followers, sends email notifications) [WRITE — requires --confirm]'
    )
    .argument('<model>', 'Odoo model (e.g., crm.lead, sale.order)')
    .argument('<id>', 'Record ID')
    .argument('[message]', 'Message body (or use --message-file)')
    .addHelpText(
      'after',
      isNote
        ? `
Examples:
  odoo mail note crm.lead 42 "Called customer, decision by end of month" --confirm
  odoo mail note project.task 17 "<p>Build <strong>passed</strong></p>" --html --confirm
  git log --oneline -5 | odoo mail note project.task 17 --message-file - --confirm
`
        : `
Examples:
  odoo mail post sale.order 88 "Your order has been shipped" --confirm
  odoo mail post crm.lead 42 --subject "Meeting confirmed" --partner-ids 7,15 \\
    "Meeting on Thursday at 10am" --confirm
`
    );

  addAuthOptions(cmd);
  cmd.addOption(confirmOption());
  cmd.addOption(dryRunOption());
  cmd.option('--html', 'Treat message as HTML (default: plain text)');
  cmd.option('--subject <subject>', 'Subject line');
  cmd.option('--message-file <file>', "Read message from file ('-' for stdin)");

  if (!isNote) {
    cmd.option('--partner-ids <n,n,...>', 'Notify these partner IDs');
  }

  return cmd;
}

function buildNoteCommand(): Command {
  const cmd = buildMailSubCommand('note');

  cmd.action(async (model: string, idStr: string, inlineMessage?: string) => {
    const opts = cmd.optsWithGlobals() as AuthFlags & {
      confirm?: boolean;
      dryRun?: boolean;
      html?: boolean;
      subject?: string;
      messageFile?: string;
    };

    const id = parseInt(idStr, 10);
    if (isNaN(id)) {
      process.stderr.write(`✗ Error: Invalid record ID '${idStr}'\n`);
      process.exit(EXIT_CODES.USAGE_ERROR);
    }

    log('mail note %s %d', model, id);

    try {
      requireConfirm('WRITE', opts, `mail note ${model}#${id}`);
    } catch (err) {
      process.exit(handleError(err));
    }

    let body: string;
    try {
      if (opts.messageFile) {
        body = await readMessageFile(opts.messageFile);
      } else if (inlineMessage) {
        body = inlineMessage;
      } else {
        process.stderr.write(
          '✗ Error: Provide a message as argument or use --message-file\n  → odoo mail note crm.lead 42 "My note" --confirm\n'
        );
        process.exit(EXIT_CODES.USAGE_ERROR);
        return;
      }
    } catch (err) {
      process.exit(handleError(err));
      return;
    }

    // Auto-wrap plain text in <p>
    const htmlBody = opts.html ? body : `<p>${escapeHtml(body)}</p>`;

    if (opts.dryRun) {
      printDryRun(model, 'message_post', [[id]], {
        body: htmlBody,
        subject: opts.subject,
        message_type: 'comment',
        subtype_xmlid: 'mail.mt_note',
      });
      return;
    }

    let client;
    try {
      client = await createAuthClient(opts);
    } catch (err) {
      process.exit(handleError(err));
    }

    try {
      const messageId = await client.mail.postInternalNote(model, id, htmlBody, {
        partnerIds: [],
      });
      printSuccess(`Internal note posted on ${model}#${id} (message id=${messageId})`);
    } catch (err) {
      process.exit(handleError(err));
    } finally {
      client?.logout();
    }
  });

  return cmd;
}

function buildPostCommand(): Command {
  const cmd = buildMailSubCommand('post');

  cmd.action(async (model: string, idStr: string, inlineMessage?: string) => {
    const opts = cmd.optsWithGlobals() as AuthFlags & {
      confirm?: boolean;
      dryRun?: boolean;
      html?: boolean;
      subject?: string;
      messageFile?: string;
      partnerIds?: string;
    };

    const id = parseInt(idStr, 10);
    if (isNaN(id)) {
      process.stderr.write(`✗ Error: Invalid record ID '${idStr}'\n`);
      process.exit(EXIT_CODES.USAGE_ERROR);
    }

    log('mail post %s %d', model, id);

    try {
      requireConfirm('WRITE', opts, `mail post ${model}#${id}`);
    } catch (err) {
      process.exit(handleError(err));
    }

    let body: string;
    try {
      if (opts.messageFile) {
        body = await readMessageFile(opts.messageFile);
      } else if (inlineMessage) {
        body = inlineMessage;
      } else {
        process.stderr.write('✗ Error: Provide a message as argument or use --message-file\n');
        process.exit(EXIT_CODES.USAGE_ERROR);
        return;
      }
    } catch (err) {
      process.exit(handleError(err));
      return;
    }

    const htmlBody = opts.html ? body : `<p>${escapeHtml(body)}</p>`;

    let partnerIds: number[] = [];
    if (opts.partnerIds) {
      try {
        partnerIds = parseIds(opts.partnerIds);
      } catch (err) {
        process.exit(handleError(err));
        return;
      }
    }

    if (opts.dryRun) {
      printDryRun(model, 'message_post', [[id]], {
        body: htmlBody,
        subject: opts.subject,
        partner_ids: partnerIds,
        message_type: 'comment',
        subtype_xmlid: 'mail.mt_comment',
      });
      return;
    }

    let client;
    try {
      client = await createAuthClient(opts);
    } catch (err) {
      process.exit(handleError(err));
    }

    try {
      const messageId = await client.mail.postOpenMessage(model, id, htmlBody, {
        partnerIds,
      });
      printSuccess(`Message posted on ${model}#${id} (message id=${messageId})`);
    } catch (err) {
      process.exit(handleError(err));
    } finally {
      client?.logout();
    }
  });

  return cmd;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
