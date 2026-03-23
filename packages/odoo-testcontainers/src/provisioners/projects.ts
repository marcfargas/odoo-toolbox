/**
 * Provisioner: Projects, stages, and tasks.
 *
 * Provisioning order within each project:
 *   project.project → project.task.type (stages) → project.task
 *
 * Stage sequence is preserved by multiplying the array index by 10.
 * Tasks reference stages by name; the stage must exist in the project.
 */

import debug from 'debug';
import type { ProjectConfig, ProvisionerClient } from './types';

const log = debug('odoo-test-harness:projects');

export interface ProjectProvisionResult {
  /** project name → project.project ID */
  projects: Record<string, number>;
  /** task name → project.task ID */
  tasks: Record<string, number>;
}

/**
 * Create projects with their stages and tasks.
 *
 * @param client - Authenticated client (ProvisionerClient-compatible)
 * @param configs - Project configurations
 * @returns Refs for projects and tasks
 */
export async function provisionProjects(
  client: ProvisionerClient,
  configs: ProjectConfig[]
): Promise<ProjectProvisionResult> {
  const projects: Record<string, number> = {};
  const tasks: Record<string, number> = {};

  if (configs.length === 0) {
    log('No projects requested — skipping');
    return { projects, tasks };
  }

  log('Provisioning %d project(s)', configs.length);

  for (const config of configs) {
    // Create the project
    const projectId = await client.create('project.project', { name: config.name });
    log('Created project "%s" → id=%d', config.name, projectId);
    projects[config.name] = projectId;

    // Create stages and build name→ID map for task resolution
    const stageRefs: Record<string, number> = {};

    if (config.stages && config.stages.length > 0) {
      log('Creating %d stage(s) for project "%s"', config.stages.length, config.name);

      for (const [i, stageName] of config.stages.entries()) {
        const stageId = await client.create('project.task.type', {
          name: stageName,
          // Many2many: link stage to this project without replacing others
          project_ids: [[4, projectId]],
          sequence: (i + 1) * 10,
        });
        log('  Created stage "%s" → id=%d (seq=%d)', stageName, stageId, (i + 1) * 10);
        stageRefs[stageName] = stageId;
      }
    }

    // Create tasks
    if (config.tasks && config.tasks.length > 0) {
      log('Creating %d task(s) for project "%s"', config.tasks.length, config.name);

      for (const taskConfig of config.tasks) {
        const taskValues: Record<string, any> = {
          name: taskConfig.name,
          project_id: projectId,
        };

        if (taskConfig.stage) {
          const stageId = stageRefs[taskConfig.stage];
          if (stageId === undefined) {
            throw new Error(
              `Task "${taskConfig.name}" references unknown stage "${taskConfig.stage}" ` +
                `in project "${config.name}". Make sure the stage is in the stages array.`
            );
          }
          taskValues.stage_id = stageId;
        }

        const taskId = await client.create('project.task', taskValues);
        log('  Created task "%s" → id=%d', taskConfig.name, taskId);
        tasks[taskConfig.name] = taskId;
      }
    }
  }

  return { projects, tasks };
}
