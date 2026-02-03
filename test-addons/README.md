# Test Addons

This directory contains OCA (Odoo Community Association) modules for testing and introspection.

## How It Works

The `docker/odoo-entrypoint.sh` script automatically scans this directory for OCA repositories and adds them to Odoo's addons-path. Simply clone any OCA repo here, restart Docker, and install the module.

## Adding OCA Modules

```bash
cd test-addons

# Clone any OCA repository (use 17.0 branch)
git clone --depth 1 -b 17.0 https://github.com/OCA/<repo-name>.git

# Restart Docker to detect new addons
npm run odoo:down && npm run odoo:up
node scripts/wait-for-odoo.js

# Install the module
npm run odoo:addon:install <module-name>
```

## Example: MIS Builder

```bash
# Clone repos
git clone --depth 1 -b 17.0 https://github.com/OCA/mis-builder.git
git clone --depth 1 -b 17.0 https://github.com/OCA/reporting-engine.git
git clone --depth 1 -b 17.0 https://github.com/OCA/server-ux.git
git clone --depth 1 -b 17.0 https://github.com/OCA/l10n-spain.git

# After Docker restart, install:
npm run odoo:addon:install date_range
npm run odoo:addon:install report_xlsx
npm run odoo:addon:install mis_builder
npm run odoo:addon:install l10n_es_mis_report
```

## Directory Structure

```
test-addons/
├── README.md             # This file (tracked in git)
├── mis-builder/          # OCA/mis-builder (git-ignored)
├── reporting-engine/     # OCA/reporting-engine (git-ignored)
├── server-ux/            # OCA/server-ux (git-ignored)
└── l10n-spain/           # OCA/l10n-spain (git-ignored)
```

## Notes

- All subdirectories are git-ignored (except this README)
- Repos are mounted read-only in Docker at `/mnt/oca`
- Use `--depth 1` for shallow clones to save disk space
- The entrypoint auto-discovers any repo with `__manifest__.py` files
