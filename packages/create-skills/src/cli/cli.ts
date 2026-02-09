#!/usr/bin/env node
/**
 * CLI entry point for @marcfargas/create-odoo-skills
 *
 * Commands:
 *   create-skills [project-name]  - Create new skills project
 *   create-skills validate        - Validate skills and references
 *   create-skills test            - Test code examples against Odoo
 *   create-skills build           - Build for distribution
 */

import { Command } from 'commander';
import { initCommand } from './commands/init';
import { validateCommand } from './commands/validate';
import { testCommand } from './commands/test';
import { buildCommand } from './commands/build';

const program = new Command();

program
  .name('create-skills')
  .description('Scaffold Odoo skill projects for AI agents')
  .version('0.1.0');

// Default command: create new project
program
  .argument('[project-name]', 'Name of the project to create')
  .option('--no-git', 'Skip git initialization')
  .action(async (projectName: string | undefined, options: { git: boolean }) => {
    if (projectName) {
      await initCommand(projectName, options);
    } else {
      program.help();
    }
  });

// Validate command
program
  .command('validate')
  .description('Validate skills and check references in SKILL.md')
  .option('-q, --quiet', 'Only show errors and warnings')
  .action(async (options: { quiet?: boolean }) => {
    await validateCommand(options);
  });

// Test command
program
  .command('test')
  .description('Test code examples against Odoo')
  .option('--file <path>', 'Test specific file only')
  .action(async (options: { file?: string }) => {
    await testCommand(options);
  });

// Build command
program
  .command('build')
  .description('Build skills package for distribution')
  .option('-o, --output <path>', 'Output path for the zip file')
  .action(async (options: { output?: string }) => {
    await buildCommand(options);
  });

program.parse();
