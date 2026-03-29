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
    reporters: process.env.GITHUB_ACTIONS ? ['default', 'github-actions'] : ['./test/Reporter.ts'],
    setupFiles: ['./test/setup.ts'],
    environment: 'node',
    include: ['test/**/*.test.ts'],
    coverage: {
      enabled: false,
      provider: 'v8',
      reporter: ['text', 'lcov', 'clover', 'json'],
      reportsDirectory: 'coverage',
      include: ['src/**/*.ts'],
    },
  },
})
