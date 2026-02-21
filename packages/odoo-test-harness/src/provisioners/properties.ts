/**
 * Provisioner: Task property definitions.
 *
 * In Odoo 17, task properties are stored on project.project via the
 * `task_properties_definition` field. Each property definition has:
 *   - name: unique technical identifier (generated here as prop_N_slug)
 *   - string: human-readable label
 *   - type: field type
 *   - selection: [[value, label], ...] pairs (selection type only)
 *
 * @see https://github.com/odoo/odoo/blob/17.0/addons/project/models/project_task.py
 */

import debug from 'debug';
import type { PropertyConfig, ProvisionerClient } from '../types';

const log = debug('odoo-test-harness:properties');

/**
 * Build a stable technical name for a property from its human label.
 * e.g. "Estimated Hours" → "prop_2_estimated_hours"
 */
function propertyTechName(index: number, label: string): string {
  const slug = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
  return `prop_${index}_${slug}`;
}

/**
 * Build the Odoo property definition object for a PropertyConfig.
 */
function buildPropertyDef(index: number, config: PropertyConfig): Record<string, any> {
  const def: Record<string, any> = {
    name: propertyTechName(index, config.name),
    string: config.name,
    type: config.type,
  };

  if (config.type === 'selection' && config.options && config.options.length > 0) {
    // Odoo expects [[technical_value, "Label"], ...]
    def.selection = config.options.map((opt) => [
      opt
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_|_$/g, ''),
      opt,
    ]);
  }

  return def;
}

/**
 * Apply task property definitions to all provisioned projects.
 *
 * Replaces the existing task_properties_definition on each project.
 * This is safe in a fresh test environment since there are no existing
 * task property values to lose.
 *
 * @param client - Authenticated client (ProvisionerClient-compatible)
 * @param projectIds - IDs of all provisioned projects to apply properties to
 * @param properties - Property configurations
 */
export async function provisionTaskProperties(
  client: ProvisionerClient,
  projectIds: number[],
  properties: PropertyConfig[]
): Promise<void> {
  if (properties.length === 0) {
    log('No task properties requested — skipping');
    return;
  }

  if (projectIds.length === 0) {
    log('No projects to apply task properties to — skipping');
    return;
  }

  const defs = properties.map((p, i) => buildPropertyDef(i, p));
  log('Applying %d task property definition(s) to %d project(s)', defs.length, projectIds.length);

  for (const projectId of projectIds) {
    await client.write('project.project', projectId, {
      task_properties_definition: defs,
    });
    log('  Applied task properties to project id=%d', projectId);
  }
}
