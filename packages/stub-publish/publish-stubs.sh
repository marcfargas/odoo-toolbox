#!/bin/bash
# Publish placeholder packages to claim names and configure Trusted Publishing.
# Run from packages/stub-publish/
# Prerequisites: npm login (as marcfargas)
#
# After publishing all 4, go to npmjs.com → each package → Settings → Trusted Publisher
# and configure GitHub Actions (marcfargas/odoo-toolbox, release.yml).
# Then: deprecate all 0.0.1 stubs once 0.1.0 is published.

set -e

PACKAGES=(
  "@marcfargas/odoo-client|Lightweight TypeScript client for Odoo RPC operations|packages/odoo-client"
  "@marcfargas/odoo-introspection|TypeScript introspection and code generation for Odoo models|packages/odoo-introspection"
  "@marcfargas/odoo-state-manager|State management with drift detection for Odoo|packages/odoo-state-manager"
  "@marcfargas/create-odoo-skills|CLI to scaffold Odoo skill projects for AI agents|packages/create-skills"
)

for entry in "${PACKAGES[@]}"; do
  IFS='|' read -r name desc dir <<< "$entry"
  echo ""
  echo "=== Publishing $name ==="

  # Rewrite package.json for this package
  cat > package.json <<EOF
{
  "name": "$name",
  "version": "0.0.1",
  "description": "$desc — placeholder for Trusted Publishing setup",
  "main": "index.js",
  "files": ["index.js", "LICENSE", "README.md"],
  "author": "Marc Fargas <marc@marcfargas.com>",
  "license": "LGPL-3.0",
  "repository": {
    "type": "git",
    "url": "https://github.com/marcfargas/odoo-toolbox.git",
    "directory": "$dir"
  },
  "publishConfig": {
    "access": "public"
  }
}
EOF

  # Rewrite README
  cat > README.md <<EOF
# $name

> ⚠️ **Placeholder** — this version exists solely to claim the package name and configure Trusted Publishing. Real release coming soon.

See [odoo-toolbox](https://github.com/marcfargas/odoo-toolbox) for the actual project.

## License

LGPL-3.0
EOF

  npm publish --access public
  echo "✓ $name@0.0.1 published"
done

echo ""
echo "All stubs published. Next steps:"
echo "1. Go to npmjs.com → each package → Settings → Trusted Publisher"
echo "2. Configure: GitHub Actions, marcfargas/odoo-toolbox, release.yml"
echo "3. Once 0.1.0 is out: npm deprecate '@marcfargas/odoo-client@0.0.1' 'Use 0.1.0+'"
