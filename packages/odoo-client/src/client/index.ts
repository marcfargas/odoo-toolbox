// Main OdooClient class
export { OdooClient, type OdooClientConfig } from './odoo-client';
export { ModuleManager, type ModuleInfo, type ModuleListOptions } from './module-manager';
export { configFromEnv } from './config';

// Mail / Chatter helpers (also available as client.postInternalNote / client.postOpenMessage)
export { postInternalNote, postOpenMessage, ensureHtmlBody, type PostMessageOptions } from './mail';
