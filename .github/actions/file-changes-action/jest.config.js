module.exports = {
  preset: 'ts-jest',
  testEnvironment: "node",
  testRunner: 'jest-circus/runner',
  testMatch: ['**/*.test.ts'],
  testPathIgnorePatterns: ['/src/tests/integration.test.ts'],
  clearMocks: true,
  collectCoverage: false,
  coverageThreshold: {
    global: {
      branches: 50,
      functions: 70,
      lines: 75,
      statements: 75
    },
    './src/*.ts': {
      branches: 70,
      functions: 85,
      lines: 85,
      statements: 85
    },
    './src/tests/**/*.ts': {
      branches: 50,
      functions: 60,
      lines: 65,
      statements: 65
    }
  }
}
