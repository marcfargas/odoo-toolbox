#!/usr/bin/env bash
# Compute the 12-char seed hash for a given Odoo version.
#
# Usage: bash docker/compute-seed-hash.sh <odoo-version>
#   e.g. bash docker/compute-seed-hash.sh 17.0
#
# Outputs a 12-character hex hash to stdout. Used by both:
#   - .github/workflows/build-seed-db.yml  (build + tag)
#   - .github/workflows/test.yml           (cache-hit probe)
#
# Hash inputs (all seed-defining files):
#   sorted(modules) + "::" + postgresImage
#   + "::" + sha256(docker/odoo-entrypoint.sh)[:8]
#   + "::" + sha256(docker/seed-db-init.sh)[:8]
#   + "::" + sha256(docker/Dockerfile.seed-db)[:8]
#
# Changing ANY of these inputs invalidates the cached image.

set -euo pipefail

VERSION="${1:-17.0}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG="${SCRIPT_DIR}/seed-config.json"

if ! command -v jq &>/dev/null; then
  echo "error: jq is required" >&2
  exit 1
fi

# If this version is not in seed-config.json, exit 0 with no output.
# The caller (test.yml) treats empty output as "no seed for this version".
MODULES=$(jq -r --arg v "$VERSION" '
  if .versions[$v] then
    .versions[$v].modules | sort | join(",")
  else
    ""
  end
' "$CONFIG")

if [ -z "$MODULES" ]; then
  # Version not configured — output nothing so callers can detect a MISS
  exit 0
fi

PG_IMAGE=$(jq -r '.postgresImage' "$CONFIG")

H_ENTRYPOINT=$(sha256sum "${SCRIPT_DIR}/odoo-entrypoint.sh"  | cut -c1-8)
H_INIT=$(sha256sum       "${SCRIPT_DIR}/seed-db-init.sh"     | cut -c1-8)
H_DOCKERFILE=$(sha256sum "${SCRIPT_DIR}/Dockerfile.seed-db"  | cut -c1-8)

INPUT="${MODULES}::${PG_IMAGE}::${H_ENTRYPOINT}::${H_INIT}::${H_DOCKERFILE}"
printf '%s' "$INPUT" | sha256sum | cut -c1-12
