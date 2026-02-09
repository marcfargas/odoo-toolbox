/**
 * Odoo module services — domain-specific helpers accessed via client accessors.
 *
 * Architecture: Option D (client accessors with lazy getters)
 *
 * Usage:
 *   client.mail.postInternalNote(...)    // ← primary API, shown in skill docs
 *   client.modules.isModuleInstalled(..) // ← module management
 *
 * Standalone functions are also exported for advanced composition:
 *   import { postInternalNote } from '@marcfargas/odoo-client';
 *   await postInternalNote(client, model, id, body);
 *
 * Adding a new service:
 *   1. Create services/{module}/ directory (service class + functions + types)
 *   2. Add lazy getter in odoo-client.ts
 *   3. Export from this barrel
 *   4. Update skill docs to show client.{module}.* pattern
 */

export * from './mail';
export * from './modules';
