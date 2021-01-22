module.exports = {
  clearMocks: true,
  moduleFileExtensions: ['js', 'ts'],
  testEnvironment: 'node',
  testMatch: ['**/*.test.ts'],
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
  transformIgnorePatterns: [
    '/node_modules/(?!@actions).+\\.js$',
  ],
  verbose: true,
};

// suppress debug messages
const processStdoutWrite = process.stdout.write.bind(process.stdout);
process.stdout.write = (str, encoding, cb) => {
  processStdoutWrite(str.split('\n').filter(x => {
    return !/^::debug::/.test(x);
  }).join('\n'), encoding, cb);
};
