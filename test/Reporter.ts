import type { Reporter, File, Task, TaskResultPack } from 'vitest'

const C = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  italic: '\x1b[3m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  gray: '\x1b[90m',
  bgGreen: '\x1b[42m',
  bgRed: '\x1b[41m',
  bgYellow: '\x1b[43m',
  black: '\x1b[30m',
}

const PASS = `${C.bgGreen}${C.black}${C.bold} PASS ${C.reset}`
const FAIL = `${C.bgRed}${C.white}${C.bold} FAIL ${C.reset}`
const RUN = `${C.bgYellow}${C.black}${C.bold} RUN  ${C.reset}`

export default class RyanlinkReporter implements Reporter {
  #start = Date.now()
  #runningFiles = new Map<string, number>() // file -> start time

  onInit() {
    this.#start = Date.now()
    process.stdout.write('\x1b[2J\x1b[H')
    console.log()
  }

  onTaskUpdate(packs: TaskResultPack[]) {
    for (const [id, result] of packs) {
      if (!result) continue
      // We handle per-file output in onFinished for simplicity
    }
  }

  onFinished(files: File[] = []) {
    const elapsed = ((Date.now() - this.#start) / 1000).toFixed(3)

    let totalTests = 0
    let passedTests = 0
    let failedTests = 0
    let skippedTests = 0
    const failedSuites: string[] = []

    // Per-file results (Jest style)
    for (const file of files) {
      const name = this.#relativeName(file.name)
      const tasks = this.#collectTests(file)
      const passed = tasks.filter((t) => t.result?.state === 'pass').length
      const failed = tasks.filter((t) => t.result?.state === 'fail').length
      const skipped = tasks.filter((t) => t.result?.state === 'skip' || t.mode === 'skip' || t.mode === 'todo').length
      const fileDuration = ((file.result?.duration ?? 0) / 1000).toFixed(3)

      totalTests += tasks.length
      passedTests += passed
      failedTests += failed
      skippedTests += skipped

      const badge = failed > 0 ? FAIL : PASS
      console.log(`${badge} ${C.gray}${name}${C.reset} ${C.gray}(${fileDuration}s)${C.reset}`)

      if (failed > 0) {
        failedSuites.push(name)
        this.#printFailedTests(file)
      }
    }

    console.log()

    // Failed test details block (Jest style)
    if (failedTests > 0) {
      console.log(`${C.bold}${C.red}● Failed Tests${C.reset}`)
      console.log()
    }

    // Summary line
    const suiteWord = files.length === 1 ? 'test suite' : 'test suites'
    const suiteSummary =
      failedSuites.length > 0
        ? `${C.red}${C.bold}${failedSuites.length} failed${C.reset}, ${C.green}${C.bold}${files.length - failedSuites.length} passed${C.reset}, ${files.length} total`
        : `${C.green}${C.bold}${files.length} passed${C.reset}, ${files.length} total`

    const testSummary =
      failedTests > 0
        ? `${C.red}${C.bold}${failedTests} failed${C.reset}, ${C.green}${C.bold}${passedTests} passed${C.reset}${skippedTests > 0 ? `, ${C.yellow}${skippedTests} skipped${C.reset}` : ''}, ${totalTests} total`
        : `${C.green}${C.bold}${passedTests} passed${C.reset}${skippedTests > 0 ? `, ${C.yellow}${skippedTests} skipped${C.reset}` : ''}, ${totalTests} total`

    console.log(`${C.bold}Test Suites:${C.reset} ${suiteSummary}`)
    console.log(`${C.bold}Tests:       ${C.reset} ${testSummary}`)
    console.log(`${C.bold}Snapshots:   ${C.reset} 0 total`)
    console.log(`${C.bold}Time:        ${C.reset} ${C.cyan}${elapsed}s${C.reset}`)
    console.log(`${C.bold}Ran all test suites.${C.reset}`)
    console.log()

    if (failedTests === 0) {
      console.log(`${C.green}${C.bold}✓ All tests passed${C.reset}`)
    } else {
      console.log(`${C.red}${C.bold}✗ ${failedTests} test${failedTests > 1 ? 's' : ''} failed${C.reset}`)
    }
    console.log()
  }

  #printFailedTests(file: File) {
    const tasks = this.#collectTests(file)
    for (const task of tasks) {
      if (task.result?.state !== 'fail') continue
      const err = task.result?.errors?.[0]
      console.log()
      console.log(`  ${C.red}● ${task.suite?.name ? `${task.suite.name} › ` : ''}${task.name}${C.reset}`)
      console.log()
      if (err) {
        const msg = err.message ?? String(err)
        for (const line of msg.split('\n')) {
          console.log(`    ${C.red}${line}${C.reset}`)
        }
        if (err.stackStr) {
          console.log()
          const stackLines = err.stackStr.split('\n').slice(0, 5)
          for (const line of stackLines) {
            console.log(`    ${C.gray}${line}${C.reset}`)
          }
        }
      }
      console.log()
    }
  }

  #relativeName(fullPath: string): string {
    const parts = fullPath.replace(/\\/g, '/').split('/')
    // Show last 2 segments: e.g. test/sanity.test.ts
    return parts.slice(-2).join('/')
  }

  #collectTests(task: Task): Task[] {
    const tests: Task[] = []
    const runner = (t: Task) => {
      if (t.type === 'test') tests.push(t)
      else if (t.type === 'suite') t.tasks.forEach(runner)
    }
    runner(task)
    return tests
  }
}
