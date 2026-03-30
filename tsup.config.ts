import { readFileSync } from 'node:fs'
import { defineConfig } from 'tsup'

const pkg = JSON.parse(readFileSync('package.json', 'utf8'))

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'],
  outDir: 'dist',
  sourcemap: false,
  minify: false,
  splitting: false,
  dts: true,
  clean: true,
  bundle: true,
  target: 'es2022',
  platform: 'node',
  define: {
    $clientName: JSON.stringify(pkg.name),
    $clientVersion: JSON.stringify(pkg.version),
    $clientRepository: JSON.stringify(pkg.repository?.url || pkg.homepage || ''),
  },
  esbuildOptions(options) {
    options.banner = {
      js: `/* ${pkg.name} v${pkg.version} - ${pkg.description} | ${pkg.license} License | ${pkg.repository?.url || pkg.homepage} */`,
    }
  },
  outExtension: ({ format }) => ({
    js: format === 'cjs' ? '.cjs' : '.mjs',
  }),
})
