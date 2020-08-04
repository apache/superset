'use strict';

const RuleTester = require('eslint').RuleTester;
const rule = require('../prefer-strict-equal');

const ruleTester = new RuleTester();

ruleTester.run('prefer-strict-equal', rule, {
  valid: [
    'expect(something).toStrictEqual(somethingElse);',
    "a().toEqual('b')",
  ],
  invalid: [
    {
      code: 'expect(something).toEqual(somethingElse);',
      errors: [
        {
          message: 'Use toStrictEqual() instead',
          column: 19,
          line: 1,
        },
      ],
      output: 'expect(something).toStrictEqual(somethingElse);',
    },
  ],
});
