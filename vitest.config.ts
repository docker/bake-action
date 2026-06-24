import {defineConfig} from 'vitest/config';

export default defineConfig({
  test: {
    clearMocks: true,
    environment: 'node',
    setupFiles: ['./__tests__/setup.unit.ts'],
    include: ['**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['clover'],
      include: ['src/**/*.ts', 'subaction/matrix/src/**/*.ts', 'subaction/get-changes/src/**/*.ts'],
      exclude: ['src/**/main.ts', 'subaction/matrix/src/**/main.ts', 'subaction/get-changes/src/**/main.ts']
    }
  }
});
