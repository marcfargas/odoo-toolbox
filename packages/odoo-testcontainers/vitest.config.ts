import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    testTimeout: 300_000, // 5 minutes for container startup
    hookTimeout: 300_000, // 5 minutes for beforeAll/afterAll hooks
  },
});
