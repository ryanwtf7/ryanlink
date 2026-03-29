/** @type {import('ts-jest').JestConfigWithTsJest} */
export default {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/test/**/*.test.ts'],
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
