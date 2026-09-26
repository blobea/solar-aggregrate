// @ts-check
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['engine/**/*.test.js', 'tests/unit/**/*.test.js'],
    environment: 'node',
  },
});
