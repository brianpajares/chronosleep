import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, 'src'),
      '@spec': path.resolve(import.meta.dirname, 'spec'),
      'server-only': path.resolve(import.meta.dirname, 'tests/stubs/server-only.ts'),
    },
  },
  test: {
    environment: 'node',
    include: ['tests/unit/**/*.test.ts', 'tests/unit/**/*.test.tsx'],
    globals: false,
    testTimeout: 20_000,
    coverage: {
      provider: 'v8',
      include: ['src/domain/**', 'src/server/**'],
      reporter: ['text-summary', 'lcov'],
    },
  },
});
