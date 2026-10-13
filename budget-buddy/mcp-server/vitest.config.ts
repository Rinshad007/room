import { defineConfig } from 'vitest/config';
export default defineConfig({ test: { testTimeout: 15000, hookTimeout: 15000, coverage: { provider: 'v8', include: ['src/**/*.ts'], exclude: ['src/index.ts', 'src/store.ts', 'src/firebase-store.ts'], reporter: ['text', 'json-summary', 'html'], thresholds: { lines: 80, statements: 80, functions: 80, branches: 75 } } } });
