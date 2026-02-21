/**
 * URL service — the typed interface exposed via `client.urls.*`
 *
 * Generates links to Odoo records that work across all Odoo versions.
 * Delegates to standalone functions in functions.ts.
 */

import type { OdooClient } from '../../client/odoo-client';
import type { PortalUrlOptions, PortalUrlResult } from './types';
import {
  getBaseUrl as _getBaseUrl,
  getRecordUrl as _getRecordUrl,
  getPortalUrl as _getPortalUrl,
} from './functions';

/**
 * URL service providing version-agnostic link generation for Odoo records.
 *
 * Access via `client.urls` — never instantiate directly.
 *
 * Three methods:
 * - `getBaseUrl()`   → Odoo instance base URL from system parameters
 * - `getRecordUrl()` → version-agnostic redirect link (works on all versions)
 * - `getPortalUrl()`  → customer-facing portal link with access token
 */
export class UrlService {
  /** @internal */
  constructor(private client: OdooClient) {}

  /**
   * Get the base URL of the Odoo instance.
   *
   * Reads the `web.base.url` system parameter. Cached per client instance.
   *
   * @param forceRefresh - Bypass cache and re-read from Odoo
   * @returns Base URL (e.g., 'https://mycompany.odoo.com')
   */
  async getBaseUrl(forceRefresh = false): Promise<string> {
    return _getBaseUrl(this.client, forceRefresh);
  }

  /**
   * Get a version-agnostic URL that links to any Odoo record.
   *
   * Uses Odoo's `/mail/view` redirect controller — the same mechanism
   * used in notification emails. Works across ALL Odoo versions (14+).
   *
   * Behavior when the URL is accessed:
   * - Internal users → backend form view
   * - Portal users → portal page (if model has portal.mixin)
   * - Not logged in → login page, then redirect to record
   *
   * @param model - Odoo model name (e.g., 'crm.lead', 'sale.order')
   * @param resId - Record ID
   * @returns Full URL string
   *
   * @example
   * ```typescript
   * const url = await client.urls.getRecordUrl('crm.lead', 42);
   * // → 'https://mycompany.odoo.com/mail/view?model=crm.lead&res_id=42'
   * ```
   */
  async getRecordUrl(model: string, resId: number): Promise<string> {
    return _getRecordUrl(this.client, model, resId);
  }

  /**
   * Get a portal URL for a record that inherits `portal.mixin`.
   *
   * Portal URLs are customer-facing links with access tokens that allow
   * external users to view records without logging in.
   *
   * Common portal models: sale.order, account.move, project.task,
   * purchase.order, helpdesk.ticket.
   *
   * @param model - Odoo model that inherits portal.mixin
   * @param resId - Record ID
   * @param options - Optional: suffix, report type, download flag
   * @returns Portal URL result with url, accessUrl, and accessToken
   *
   * @example
   * ```typescript
   * const result = await client.urls.getPortalUrl('sale.order', 15);
   * // result.url → 'https://mycompany.odoo.com/my/orders/15?access_token=abc-...'
   *
   * // PDF download link
   * const pdf = await client.urls.getPortalUrl('account.move', 7, {
   *   reportType: 'pdf',
   *   download: true,
   * });
   * ```
   */
  async getPortalUrl(
    model: string,
    resId: number,
    options?: PortalUrlOptions
  ): Promise<PortalUrlResult> {
    return _getPortalUrl(this.client, model, resId, options);
  }
}
