module.exports = {
  setupFiles: ['<rootDir>/test/shim.js', '<rootDir>/test/setup.js'],
  setupTestFrameworkScriptFile: './test/testsSetup.js',
  coverageDirectory: './coverage',
  coveragePathIgnorePatterns: ['/node_modules/', '/esm/', '/lib/', '/build/'],
  coverageReporters: ['lcov'],
  globals: {
    __DEV__: true,
  },
  moduleFileExtensions: ['js', 'jsx', 'json'],
  testMatch: ['**/?(*.)+(spec|test).{js,jsx}'],
  testURL: 'http://localhost/',
  transform: {
    '^.+\\.jsx?$': '<rootDir>/node_modules/babel-jest',
  },
};
