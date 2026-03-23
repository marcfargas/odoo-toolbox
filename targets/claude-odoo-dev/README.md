# claude-odoo-dev

Odoo developer toolkit for Claude Code. Extends [claude-odoo-connect](https://github.com/marcfargas/odoo-toolbox) with state management, test environments, and dev workflow agents.

## What you get

Everything from claude-odoo-connect, plus:

- **State management skill** — declarative compare/plan/apply workflow for Odoo configuration (Terraform-style)
- **Test environments skill** — spin up isolated Odoo instances with Testcontainers
- **State manager agent** — autonomous agent for the full drift-detection and apply cycle
- **Odoo knowledge modules** — 5,200+ lines of battle-tested patterns

## Setup

1. Install the plugin
2. Set environment variables for your Odoo instance:

```bash
export ODOO_URL=https://your-odoo.example.com
export ODOO_DB=your-database
export ODOO_USER=admin
export ODOO_PASSWORD=your-password
```

3. Install the toolbox packages in your project:

```bash
npm install @marcfargas/odoo-client @marcfargas/odoo-state-manager @marcfargas/odoo-testcontainers
```

## Use Cases

- **Infrastructure as Code** — define Odoo configuration in files, apply with state management
- **Drift detection** — compare live Odoo state against desired configuration
- **Automation setup** — configure base.automation, server actions, and OCA modules
- **Integration testing** — spin up fresh Odoo instances for each test run
- **Module development** — test custom addons against multiple Odoo versions

## License

LGPL-3.0 (code), CC0-1.0 (knowledge modules)
