#!/bin/bash
# Custom Odoo entrypoint that dynamically builds addons-path from /mnt/oca
# This wraps the default Odoo entrypoint to add OCA modules

set -e

# Build addons-path from directories in /mnt/oca
EXTRA_ADDONS=""
if [ -d "/mnt/oca" ]; then
    for dir in /mnt/oca/*/; do
        if [ -d "$dir" ]; then
            # Only add if it contains at least one addon (directory with __manifest__.py)
            if find "$dir" -maxdepth 2 -name "__manifest__.py" -print -quit | grep -q .; then
                EXTRA_ADDONS="${EXTRA_ADDONS}${dir%/},"
            fi
        fi
    done
fi

# Default Odoo addons path
DEFAULT_ADDONS="/usr/lib/python3/dist-packages/odoo/addons"

# Combine paths (remove trailing comma)
if [ -n "$EXTRA_ADDONS" ]; then
    ADDONS_PATH="${EXTRA_ADDONS}${DEFAULT_ADDONS}"
else
    ADDONS_PATH="${DEFAULT_ADDONS}"
fi

echo "Using addons-path: $ADDONS_PATH"

# Call the original Odoo entrypoint with the addons-path added to arguments
exec /entrypoint.sh "$@" --addons-path="$ADDONS_PATH"
