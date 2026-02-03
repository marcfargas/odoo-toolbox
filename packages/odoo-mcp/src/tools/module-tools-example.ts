/**
 * Example: Sale module-specific tools
 *
 * This file demonstrates how to create module-specific tool configurations
 * that can be dynamically registered when the 'sale' module is installed.
 *
 * To integrate this:
 * 1. Import this configuration in tools/index.ts
 * 2. Register conditionally based on installed modules
 * 3. Call registry.register(saleModuleTools) when module is installed
 * 4. Call registry.unregister('sale') when module is uninstalled
 */

import { ModuleToolConfig } from './registry.js';

/**
 * Sale module tool definitions.
 *
 * These tools would only be registered when the 'sale' module is installed.
 */
export const saleModuleTools: ModuleToolConfig = {
  moduleName: 'sale',
  requiredModules: ['sale'],
  tools: [
    {
      name: 'odoo_sale_create_quotation',
      description: 'Create a new sales quotation',
      inputSchema: {
        type: 'object',
        properties: {
          partner_id: {
            type: 'number',
            description: 'Customer ID (res.partner)',
          },
          order_line: {
            type: 'array',
            description: 'Quotation lines',
            items: {
              type: 'object',
              properties: {
                product_id: { type: 'number', description: 'Product ID' },
                product_uom_qty: { type: 'number', description: 'Quantity' },
                price_unit: { type: 'number', description: 'Unit price' },
              },
              required: ['product_id', 'product_uom_qty'],
            },
          },
          validity_date: {
            type: 'string',
            description: 'Quotation expiration date (YYYY-MM-DD)',
          },
        },
        required: ['partner_id'],
      },
    },
    {
      name: 'odoo_sale_confirm_order',
      description: 'Confirm a sales quotation to create a sales order',
      inputSchema: {
        type: 'object',
        properties: {
          order_id: {
            type: 'number',
            description: 'Sales order/quotation ID',
          },
        },
        required: ['order_id'],
      },
    },
    {
      name: 'odoo_sale_get_order_lines',
      description: 'Get order lines for a sales order',
      inputSchema: {
        type: 'object',
        properties: {
          order_id: {
            type: 'number',
            description: 'Sales order ID',
          },
        },
        required: ['order_id'],
      },
    },
  ],
  handlers: new Map<string, any>([
    // Handlers would be implemented here
    [
      'odoo_sale_create_quotation',
      async (session: any, args: any) => {
        const client = session.getClient();
        const orderId = await client.create('sale.order', {
          partner_id: args.partner_id,
          order_line: args.order_line?.map((line: any) => [
            0,
            0,
            {
              product_id: line.product_id,
              product_uom_qty: line.product_uom_qty,
              price_unit: line.price_unit,
            },
          ]),
          validity_date: args.validity_date,
        });

        return {
          success: true,
          order_id: orderId,
          message: `Created sales quotation ${orderId}`,
        };
      },
    ],
    [
      'odoo_sale_confirm_order',
      async (session: any, args: any) => {
        const client = session.getClient();
        await client.call('sale.order', 'action_confirm', [[args.order_id]]);

        return {
          success: true,
          order_id: args.order_id,
          message: `Confirmed sales order ${args.order_id}`,
        };
      },
    ],
    [
      'odoo_sale_get_order_lines',
      async (session: any, args: any) => {
        const client = session.getClient();
        const order = await client.read('sale.order', [args.order_id], ['order_line']);

        if (!order || order.length === 0) {
          return {
            success: false,
            error: { code: 'NOT_FOUND', message: 'Order not found' },
          };
        }

        const lineIds = order[0].order_line as number[];
        const lines = await client.read('sale.order.line', lineIds, [
          'product_id',
          'name',
          'product_uom_qty',
          'price_unit',
          'price_subtotal',
        ]);

        return {
          success: true,
          order_id: args.order_id,
          lines,
        };
      },
    ],
  ]),
};

/**
 * Example usage in tools/index.ts:
 *
 * ```typescript
 * import { saleModuleTools } from './module-tools-example.js';
 *
 * // During initialization or when sale module is detected:
 * registry.register(saleModuleTools);
 * await registry.notifyToolListChanged();
 *
 * // When sale module is uninstalled:
 * registry.unregister('sale');
 * await registry.notifyToolListChanged();
 * ```
 */
