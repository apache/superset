'use strict';

const RuleTester = require('eslint').RuleTester;
const rule = require('../no-focused-tests');

const ruleTester = new RuleTester();
const expectedErrorMessage = 'Unexpected focused test.';

ruleTester.run('no-focused-tests', rule, {
  valid: [
    'describe()',
    'it()',
    'describe.skip()',
    'it.skip()',
    'test()',
    'test.skip()',
    'var appliedOnly = describe.only; appliedOnly.apply(describe)',
    'var calledOnly = it.only; calledOnly.call(it)',
  ],

  invalid: [
    {
      code: 'describe.only()',
      errors: [{ message: expectedErrorMessage, column: 10, line: 1 }],
    },
    {
      code: 'describe.only.each()',
      errors: [{ message: expectedErrorMessage, column: 10, line: 1 }],
    },
    {
      code: 'describe["only"]()',
      errors: [{ message: expectedErrorMessage, column: 10, line: 1 }],
    },
    {
      code: 'it.only()',
      errors: [{ message: expectedErrorMessage, column: 4, line: 1 }],
    },
    {
      code: 'it.only.each()',
      errors: [{ message: expectedErrorMessage, column: 4, line: 1 }],
    },
    {
      code: 'it["only"]()',
      errors: [{ message: expectedErrorMessage, column: 4, line: 1 }],
    },
    {
      code: 'test.only()',
      errors: [{ message: expectedErrorMessage, column: 6, line: 1 }],
    },
    {
      code: 'test.only.each()',
      errors: [{ message: expectedErrorMessage, column: 6, line: 1 }],
    },
    {
      code: 'test["only"]()',
      errors: [{ message: expectedErrorMessage, column: 6, line: 1 }],
    },
    {
      code: 'fdescribe()',
      errors: [{ message: expectedErrorMessage, column: 1, line: 1 }],
    },
    {
      code: 'fit()',
      errors: [{ message: expectedErrorMessage, column: 1, line: 1 }],
    },
    {
      code: 'fit.each()',
      errors: [{ message: expectedErrorMessage, column: 1, line: 1 }],
    },
  ],
});
