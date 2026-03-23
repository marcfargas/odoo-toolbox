import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/packaging/**/*.test.ts'],
    testTimeout: 120_000,
  },
});
