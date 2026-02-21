/**
 * Convenience presets for common Odoo setups.
 */

import {
  OdooTestContainer,
  type StartedOdooContainer,
  type OdooTestContainerOptions,
} from './odoo-container';

/**
 * Convenience function to start Odoo testcontainer.
 */
export async function startOdoo(options?: OdooTestContainerOptions): Promise<StartedOdooContainer> {
  return new OdooTestContainer(options).start();
}

/**
 * Predefined configurations for common Odoo development scenarios.
 */
export const OdooPresets = {
  /** Basic Odoo with core modules */
  standard: () =>
    startOdoo({
      modules: ['base', 'web'],
    }),

  /** HR & Attendance modules */
  hr: () =>
    startOdoo({
      modules: ['hr', 'hr_attendance'],
    }),

  /** Project management modules */
  project: () =>
    startOdoo({
      modules: ['project', 'hr_timesheet'],
    }),

  /** Sales & CRM modules */
  sales: () =>
    startOdoo({
      modules: ['sale', 'crm', 'account'],
    }),

  /** Manufacturing modules */
  manufacturing: () =>
    startOdoo({
      modules: ['mrp', 'stock', 'purchase'],
    }),

  /** Website & eCommerce modules */
  website: () =>
    startOdoo({
      modules: ['website', 'website_sale', 'website_blog'],
    }),

  /** Accounting & Finance modules */
  accounting: () =>
    startOdoo({
      modules: ['account', 'account_accountant', 'account_invoicing'],
    }),

  /** Full development environment with most common modules */
  full: () =>
    startOdoo({
      modules: [
        'hr',
        'hr_attendance',
        'hr_holidays',
        'hr_timesheet',
        'project',
        'project_timesheet',
        'sale',
        'crm',
        'account',
        'purchase',
        'stock',
        'mrp',
        'website',
        'website_sale',
      ],
    }),

  /**
   * OCA-focused preset - includes modules commonly used with OCA addons
   */
  oca: (addonsPath: string) =>
    startOdoo({
      modules: ['base', 'web', 'account', 'sale', 'purchase', 'stock', 'hr', 'project'],
      addonsPath,
    }),
};
