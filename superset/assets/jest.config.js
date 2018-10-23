module.exports = {
  testRegex: '\\/spec\\/.*_spec\\.(j|t)sx?$',
  moduleNameMapper: {
    '\\.(css|less)$': '<rootDir>/spec/__mocks__/styleMock.js',
    '\\.(gif|ttf|eot|svg)$': '<rootDir>/spec/__mocks__/fileMock.js',
    '^src/(.*)$': '<rootDir>/src/$1',
  },
  setupTestFrameworkScriptFile: '<rootDir>/spec/helpers/shim.js',
  testURL: 'http://localhost',
  collectCoverageFrom: ['src/**/*.{js,jsx,ts,tsx}'],
  coverageDirectory: '<rootDir>/coverage/',
  transform: {
    '^.+\\.jsx?$': 'babel-jest',
    '^.+\\.tsx?$': 'ts-jest',
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
};
