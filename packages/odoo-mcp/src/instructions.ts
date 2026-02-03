/**
 * Server instructions for LLM guidance.
 *
 * These instructions are provided to MCP clients during initialization
 * to help LLMs understand how to effectively use the Odoo MCP server.
 */

export const SERVER_INSTRUCTIONS = `
## Odoo MCP Server Usage Guide

This server provides tools for interacting with Odoo ERP instances via JSON-RPC.

### Understanding Odoo Responses

**Field Types:**
- **Many2one**: Returns \`[id, "Display Name"]\` tuple or \`false\`/\`null\`
- **One2many/Many2many**: Returns array of integer IDs (e.g., \`[1, 2, 3]\`)
- **Date**: ISO format string \`"2024-01-15"\`
- **Datetime**: ISO format string \`"2024-01-15T10:30:00"\`
- **Monetary**: Number (check \`currency_id\` field for the currency)
- **Selection**: String value from predefined options
- **Binary**: Base64 encoded string

**Common Field Prefixes:**
- \`x_\` → Custom fields created via Odoo Studio
- \`l10n_es_\` → Spanish localization (SII, AEAT)
- \`l10n_*_\` → Other country localizations
- \`website_\` → Website/eCommerce module fields
- \`sale_\` → Sales module extensions
- \`purchase_\` → Purchase module extensions
- \`stock_\` → Inventory module extensions
- \`hr_\` → Human Resources extensions

### Best Practices

1. **Discover Fields First:**
   Use \`odoo_get_fields\` to see available fields for any model before querying.
   This is especially useful for finding localization or module-specific fields.

2. **Efficient Queries:**
   - Always specify the \`fields\` parameter to limit returned data
   - Use \`limit\` parameter for large datasets (default: 80)
   - Use domain filters to narrow results server-side

3. **Domain Filter Syntax:**
   Odoo domains use Polish notation: \`[('field', 'operator', value)]\`
   - **Operators**: \`=\`, \`!=\`, \`>\`, \`>=\`, \`<\`, \`<=\`, \`like\`, \`ilike\`, \`in\`, \`not in\`, \`child_of\`, \`parent_of\`
   - **Combine with**: \`&\` (AND), \`|\` (OR), \`!\` (NOT)
   - **Example**: \`['&', ('state', '=', 'posted'), ('move_type', '=', 'out_invoice')]\`

4. **Handling Relationships:**
   - To get related record details, make a separate \`odoo_read\` call with the IDs
   - Or use dot notation in fields: \`['partner_id', 'partner_id.email', 'partner_id.vat']\`

5. **Common Models:**
   - \`res.partner\` - Contacts, customers, suppliers
   - \`res.users\` - System users
   - \`account.move\` - Invoices, bills, journal entries
   - \`sale.order\` - Sales orders
   - \`purchase.order\` - Purchase orders
   - \`product.product\` - Products (variants)
   - \`product.template\` - Product templates
   - \`project.project\` - Projects
   - \`project.task\` - Project tasks
   - \`crm.lead\` - CRM leads/opportunities
   - \`hr.employee\` - Employees
   - \`stock.picking\` - Inventory transfers

### Error Handling

- **Field doesn't exist**: The field may require a specific module to be installed
- **Access errors**: Check user's access rights in Odoo
- **Empty results \`[]\`**: Valid response - the search found no matches
- **Authentication errors**: Re-authenticate with \`odoo_authenticate\`

### Module Management

Use \`odoo_module_*\` tools to:
- List installed/available modules
- Install new modules (adds fields to models)
- Check module dependencies

After installing modules, use \`bypassCache: true\` in introspection calls to see new fields.

### Chatter & Activities

The mail.* tools provide access to Odoo's collaboration features:
- \`odoo_chatter_post_*\` - Add messages to any record
- \`odoo_activity_*\` - Manage scheduled activities
- \`odoo_followers_*\` - Manage record followers

Most Odoo models support chatter (inherit from mail.thread).
`;

/**
 * Get server instructions for MCP clients.
 */
export function getServerInstructions(): string {
  return SERVER_INSTRUCTIONS.trim();
}
