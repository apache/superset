'use strict';

const consistentTestIt = require('./rules/consistent-test-it');
const expectExpect = require('./rules/expect-expect');
const lowercaseName = require('./rules/lowercase-name');
const noDisabledTests = require('./rules/no-disabled-tests');
const noFocusedTests = require('./rules/no-focused-tests');
const noHooks = require('./rules/no-hooks');
const noIdenticalTitle = require('./rules/no-identical-title');
const noJasmineGlobals = require('./rules/no-jasmine-globals');
const noJestImport = require('./rules/no-jest-import');
const noLargeSnapshots = require('./rules/no-large-snapshots');
const noTestPrefixes = require('./rules/no-test-prefixes');
const noTestReturnStatement = require('./rules/no-test-return-statement');
const preferSpyOn = require('./rules/prefer-spy-on');
const preferToBeNull = require('./rules/prefer-to-be-null');
const preferToBeUndefined = require('./rules/prefer-to-be-undefined');
const preferToContain = require('./rules/prefer-to-contain');
const preferToHaveLength = require('./rules/prefer-to-have-length');
const validDescribe = require('./rules/valid-describe');
const validExpect = require('./rules/valid-expect');
const preferExpectAssertions = require('./rules/prefer-expect-assertions');
const validExpectInPromise = require('./rules/valid-expect-in-promise');
const preferInlineSnapshots = require('./rules/prefer-inline-snapshots');
const preferStrictEqual = require('./rules/prefer-strict-equal');
const requireTothrowMessage = require('./rules/require-tothrow-message');
const noAliasMethods = require('./rules/no-alias-methods');
const noTestCallback = require('./rules/no-test-callback');

const snapshotProcessor = require('./processors/snapshot-processor');

module.exports = {
  configs: {
    recommended: {
      plugins: ['jest'],
      env: {
        'jest/globals': true,
      },
      rules: {
        'jest/no-disabled-tests': 'warn',
        'jest/no-focused-tests': 'error',
        'jest/no-identical-title': 'error',
        'jest/no-jest-import': 'warn',
        'jest/prefer-to-have-length': 'warn',
        'jest/valid-expect': 'error',
      },
    },
  },
  environments: {
    globals: {
      globals: {
        afterAll: false,
        afterEach: false,
        beforeAll: false,
        beforeEach: false,
        describe: false,
        expect: false,
        fit: false,
        it: false,
        jasmine: false,
        jest: false,
        pending: false,
        pit: false,
        require: false,
        test: false,
        xdescribe: false,
        xit: false,
        xtest: false,
      },
    },
  },
  processors: {
    '.snap': snapshotProcessor,
  },
  rules: {
    'consistent-test-it': consistentTestIt,
    'expect-expect': expectExpect,
    'lowercase-name': lowercaseName,
    'no-disabled-tests': noDisabledTests,
    'no-focused-tests': noFocusedTests,
    'no-hooks': noHooks,
    'no-identical-title': noIdenticalTitle,
    'no-jasmine-globals': noJasmineGlobals,
    'no-jest-import': noJestImport,
    'no-large-snapshots': noLargeSnapshots,
    'no-test-prefixes': noTestPrefixes,
    'no-test-return-statement': noTestReturnStatement,
    'prefer-spy-on': preferSpyOn,
    'prefer-to-be-null': preferToBeNull,
    'prefer-to-be-undefined': preferToBeUndefined,
    'prefer-to-contain': preferToContain,
    'prefer-to-have-length': preferToHaveLength,
    'valid-describe': validDescribe,
    'valid-expect': validExpect,
    'prefer-expect-assertions': preferExpectAssertions,
    'valid-expect-in-promise': validExpectInPromise,
    'prefer-inline-snapshots': preferInlineSnapshots,
    'prefer-strict-equal': preferStrictEqual,
    'require-tothrow-message': requireTothrowMessage,
    'no-alias-methods': noAliasMethods,
    'no-test-callback': noTestCallback,
  },
};
