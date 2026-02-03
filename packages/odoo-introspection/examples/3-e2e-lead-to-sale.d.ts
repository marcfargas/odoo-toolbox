/**
 * Example 3: End-to-End CRM Lead to Sale Workflow
 *
 * Demonstrates how to:
 * - Install required modules (CRM and Sales) if not present
 * - Use introspection to explore CRM and Sales models before working with them
 * - Create and manage CRM leads (crm.lead)
 * - Schedule follow-up activities on records (mail.activity)
 * - Handle relational field requirements (many2one fields)
 * - Create contacts and link them to leads (res.partner)
 * - Create sales quotations from leads (sale.order)
 * - Confirm quotations using action methods
 * - Properly clean up created records
 *
 * Prerequisites:
 * - Odoo instance running
 * - Valid credentials (admin access recommended)
 *
 * Run: npx ts-node packages/odoo-introspection/examples/3-e2e-lead-to-sale.ts
 *
 * Note: This example will install the CRM and Sales modules if not already
 * installed. This is optional for users who already have these modules, but
 * required for our test suite which starts with a blank database.
 */
export {};
//# sourceMappingURL=3-e2e-lead-to-sale.d.ts.map