var config = require('./jest.config')
config.testPathIgnorePatterns = ['!/src/tests/integration.test.ts']
config.testMatch = ['**/integration.test.ts']
console.log('RUNNING INTEGRATION TESTS')
module.exports = config
