/** @type {import('ts-jest').JestConfigWithTsJest} */
export default {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: [
    '**/test/filters.test.ts',
    '**/test/lavalink.test.ts',
    '**/test/constants.test.ts',
    '**/test/sanity.test.ts',
  ],
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        diagnostics: { ignoreCodes: [1343] },
        tsconfig: {
          types: ['node', 'ws', 'jest'],
        },
      },
    ],
  },
  setupFiles: ['./test/jest.setup.ts'],
}
