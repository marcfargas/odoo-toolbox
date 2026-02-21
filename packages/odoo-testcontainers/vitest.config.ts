import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    testTimeout: 600_000, // 10 minutes — must exceed container startupTimeout (300s) with margin
    hookTimeout: 600_000, // 10 minutes for beforeAll/afterAll hooks
  },
});
