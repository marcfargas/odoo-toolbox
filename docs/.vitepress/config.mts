import { defineConfig } from 'vitepress';

export default defineConfig({
  title: 'odoo-toolbox',
  description:
    'TypeScript SDK for Odoo — RPC client, schema introspection, declarative state management, and testing utilities',
  base: '/~odoo-toolbox/',
  lang: 'en-US',
  cleanUrls: true,
  ignoreDeadLinks: true,

  head: [['meta', { name: 'theme-color', content: '#714B67' }]],

  lastUpdated: true,

  themeConfig: {
    nav: [
      { text: 'Guide', link: '/getting-started', activeMatch: '/(?:getting-started|client|services|advanced|state-manager)' },
      { text: 'Packages', link: '/packages/odoo-client', activeMatch: '/packages/' },
    ],

    sidebar: {
      '/': [
        {
          text: 'Getting Started',
          items: [
            { text: 'Introduction', link: '/getting-started' },
            { text: 'Safety Model', link: '/safety' },
          ],
        },
        {
          text: 'Client',
          collapsed: false,
          items: [
            { text: 'Connection', link: '/client/connection' },
            { text: 'CRUD Operations', link: '/client/crud' },
            { text: 'Search', link: '/client/search' },
            { text: 'Field Types', link: '/client/field-types' },
            { text: 'Error Handling', link: '/client/error-handling' },
          ],
        },
        {
          text: 'Services',
          collapsed: false,
          items: [
            { text: 'Mail', link: '/services/mail' },
            { text: 'Modules', link: '/services/modules' },
            { text: 'Attendance', link: '/services/attendance' },
            { text: 'Timesheets', link: '/services/timesheets' },
            { text: 'Accounting', link: '/services/accounting' },
            { text: 'Properties', link: '/services/properties' },
            { text: 'URLs', link: '/services/urls' },
          ],
        },
        {
          text: 'Introspection',
          collapsed: false,
          items: [
            { text: 'Schema Discovery', link: '/introspection/schema-discovery' },
            { text: 'Code Generation', link: '/introspection/codegen' },
          ],
        },
        {
          text: 'State Manager',
          collapsed: false,
          items: [
            { text: 'External IDs', link: '/state-manager/external-ids' },
            { text: 'HTML & Translations', link: '/state-manager/html-translations' },
            { text: 'Data Clone', link: '/state-manager/data-clone' },
          ],
        },
        {
          text: 'Advanced',
          collapsed: true,
          items: [
            { text: 'Domains', link: '/advanced/domains' },
            { text: 'Batch Operations', link: '/advanced/batch-operations' },
            { text: 'Multi-Company', link: '/advanced/multi-company' },
          ],
        },
      ],
      '/packages/': [
        {
          text: 'Packages',
          items: [
            { text: 'odoo-client', link: '/packages/odoo-client' },
            { text: 'odoo-introspection', link: '/packages/odoo-introspection' },
            { text: 'odoo-state-manager', link: '/packages/odoo-state-manager' },
            { text: 'odoo-testcontainers', link: '/packages/odoo-testcontainers' },
          ],
        },
      ],
    },

    socialLinks: [
      { icon: 'github', link: 'https://github.com/marcfargas/odoo-toolbox' },
      { icon: 'npm', link: 'https://www.npmjs.com/package/@marcfargas/odoo-client' },
    ],

    editLink: {
      pattern: 'https://github.com/marcfargas/odoo-toolbox/edit/master/docs/:path',
      text: 'Edit this page on GitHub',
    },

    search: {
      provider: 'local',
    },

    footer: {
      message: 'Released under the LGPL-3.0 License.',
    },
  },
});
