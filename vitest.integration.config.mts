import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    testTimeout: Number(process.env.TEST_TIMEOUT_MS) || 30000,
    hookTimeout: Number(process.env.TEST_TIMEOUT_MS) || 30000,

    root: '.',

    // Integration tests for all packages except odoo-testcontainers
    // (it starts its own containers — tested in a separate CI job)
    include: ['packages/*/tests/**/*.integration.test.ts', 'targets/*/tests/**/*.integration.test.ts'],
    exclude: ['packages/odoo-testcontainers/**'],

    // Global setup for Docker containers.
    // Teardown is returned from the globalSetup() function.
    globalSetup: './tests/helpers/globalSetup.ts',

    // Run sequentially for integration tests
    sequence: {
      concurrent: false,
    },

    // Use forks pool but allow parallel file processing
    pool: 'forks',
    fileParallelism: false,
  },
});
