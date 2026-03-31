import { defineConfig } from 'vitest/config'
import { name, version, repository } from './package.json'

export default defineConfig({
  define: {
    $clientName: `"${name}"`,
    $clientVersion: `"${version}"`,
    $clientRepository: `"${repository.url.replace(/\.git$/, '')}"`,
  },
  test: {
    globals: true,
    reporters: process.env.GITHUB_ACTIONS ? ['default'] : ['./test/Reporter.ts'],
    setupFiles: ['./test/setup.ts'],
    environment: 'node',
    include: ['test/**/*.test.ts'],
    pool: 'threads',
    clearMocks: true,
    dangerouslyIgnoreUnhandledErrors: true,
    coverage: {
      enabled: false,
      provider: 'istanbul',
      reporter: ['text', 'lcov', 'clover', 'json'],
      reportsDirectory: 'coverage',
      include: ['src/**/*.ts'],
    },
  },
})
