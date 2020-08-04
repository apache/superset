'use strict';

const RuleTester = require('eslint').RuleTester;
const rule = require('../prefer-to-be-null');

const ruleTester = new RuleTester();

ruleTester.run('prefer-to-be-null', rule, {
  valid: [
    'expect(null).toBeNull();',
    'expect(null).toEqual();',
    'expect(null).not.toBeNull();',
    'expect(null).not.toEqual();',
    'expect(null).toBe(undefined);',
    'expect(null).not.toBe(undefined);',
    'expect(null).toBe();',
    'expect(null).toMatchSnapshot();',
    'expect("a string").toMatchSnapshot(null);',
    'expect("a string").not.toMatchSnapshot();',
    "expect(something).toEqual('a string');",
  ],

  invalid: [
    {
      code: 'expect(null).toBe(null);',
      errors: [
        {
          message: 'Use toBeNull() instead',
          column: 14,
          line: 1,
        },
      ],
      output: 'expect(null).toBeNull();',
    },
    {
      code: 'expect(null).toEqual(null);',
      errors: [
        {
          message: 'Use toBeNull() instead',
          column: 14,
          line: 1,
        },
      ],
      output: 'expect(null).toBeNull();',
    },
    {
      code: 'expect("a string").not.toBe(null);',
      errors: [
        {
          message: 'Use toBeNull() instead',
          column: 24,
          line: 1,
        },
      ],
      output: 'expect("a string").not.toBeNull();',
    },
    {
      code: 'expect("a string").not.toEqual(null);',
      errors: [
        {
          message: 'Use toBeNull() instead',
          column: 24,
          line: 1,
        },
      ],
      output: 'expect("a string").not.toBeNull();',
    },
  ],
});
