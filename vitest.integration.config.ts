import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    testTimeout: Number(process.env.TEST_TIMEOUT_MS) || 30000,

    root: '.',

    // Only integration tests (packages and meta-skills docs)
    include: [
      'packages/*/tests/**/*.integration.test.ts',
      'docs/meta-skills/__tests__/**/*.integration.test.ts',
    ],

    // Global setup/teardown for Docker containers
    globalSetup: './tests/helpers/globalSetup.ts',
    globalTeardown: './tests/helpers/globalTeardown.ts',

    // Run sequentially for integration tests
    sequence: {
      concurrent: false,
    },

    // Use forks pool but allow parallel file processing
    pool: 'forks',
    fileParallelism: false,
  },
});
