import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Global test settings
    globals: true,
    environment: 'node',
    testTimeout: Number(process.env.TEST_TIMEOUT_MS) || 30000,

    // Root directory for tests
    root: '.',

    // Include patterns
    include: ['packages/*/tests/**/*.test.ts'],

    // Exclude integration tests from default run
    exclude: ['**/*.integration.test.ts', '**/node_modules/**'],

    // Coverage configuration
    coverage: {
      provider: 'v8',
      include: ['packages/*/src/**/*.ts'],
      exclude: ['**/*.test.ts'],
    },
  },
});
