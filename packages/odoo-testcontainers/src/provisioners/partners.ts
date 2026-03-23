/**
 * Provisioner: Partner categories and partners.
 *
 * Categories are created first (idempotent: search-before-create).
 * Partners are created after categories so category IDs are available.
 * Parent companies must appear before child contacts in the config array.
 */

import debug from 'debug';
import type { PartnerConfig, ProvisionerClient } from './types';

const log = debug('odoo-test-harness:partners');

/**
 * Create partner categories, skipping any that already exist by name.
 *
 * @param client - Authenticated client (ProvisionerClient-compatible)
 * @param categoryNames - Category names to provision
 * @returns Map of category name → res.partner.category ID
 */
export async function provisionPartnerCategories(
  client: ProvisionerClient,
  categoryNames: string[]
): Promise<Record<string, number>> {
  const refs: Record<string, number> = {};

  if (categoryNames.length === 0) {
    log('No partner categories requested — skipping');
    return refs;
  }

  log('Provisioning partner categories: %o', categoryNames);

  for (const name of categoryNames) {
    // Idempotent: search first
    const existing = await client.search('res.partner.category', [['name', '=', name]]);
    if (existing.length > 0) {
      log('Category "%s" already exists (id=%d) — reusing', name, existing[0]);
      refs[name] = existing[0];
    } else {
      const id = await client.create('res.partner.category', { name });
      log('Created category "%s" → id=%d', name, id);
      refs[name] = id;
    }
  }

  return refs;
}

/**
 * Create partners from config.
 *
 * Partners referencing a parentName must have their parent appear earlier in
 * the config array. Category must exist in categoryRefs.
 *
 * @param client - Authenticated client (ProvisionerClient-compatible)
 * @param partners - Partner configurations
 * @param categoryRefs - Map of category name → ID (from provisionPartnerCategories)
 * @returns Map of partner name → res.partner ID
 */
export async function provisionPartners(
  client: ProvisionerClient,
  partners: PartnerConfig[],
  categoryRefs: Record<string, number>
): Promise<Record<string, number>> {
  const refs: Record<string, number> = {};

  if (partners.length === 0) {
    log('No partners requested — skipping');
    return refs;
  }

  log('Provisioning %d partner(s)', partners.length);

  for (const config of partners) {
    const values: Record<string, any> = {
      name: config.name,
      is_company: config.isCompany ?? false,
    };

    if (config.email) {
      values.email = config.email;
    }

    if (config.category) {
      const catId = categoryRefs[config.category];
      if (catId === undefined) {
        throw new Error(
          `Partner "${config.name}" references unknown category "${config.category}". ` +
            `Make sure it is listed in partnerCategories.`
        );
      }
      // Many2many: [(4, id)] links without replacing
      values.category_id = [[4, catId]];
    }

    if (config.parentName) {
      const parentId = refs[config.parentName];
      if (parentId === undefined) {
        throw new Error(
          `Partner "${config.name}" references unknown parent "${config.parentName}". ` +
            `Make sure the parent appears earlier in the partners array.`
        );
      }
      values.parent_id = parentId;
    }

    const id = await client.create('res.partner', values);
    log('Created partner "%s" → id=%d', config.name, id);
    refs[config.name] = id;
  }

  return refs;
}
