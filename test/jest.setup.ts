import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const pkg = JSON.parse(readFileSync(join(__dirname, '../package.json'), 'utf8'))

;(globalThis as any).$clientName = pkg.name
;(globalThis as any).$clientVersion = pkg.version
;(globalThis as any).$clientRepository = pkg.repository.url.replace(/\.git$/, '')
