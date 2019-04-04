'use strict';

const RuleTester = require('eslint').RuleTester;
const rule = require('../require-tothrow-message');

const ruleTester = new RuleTester({
  parserOptions: {
    ecmaVersion: 6,
  },
});

ruleTester.run('require-tothrow-message', rule, {
  valid: [
    // String
    "expect(() => { throw new Error('a'); }).toThrow('a');",
    "expect(() => { throw new Error('a'); }).toThrowError('a');",

    // Template literal
    "const a = 'a'; expect(() => { throw new Error('a'); }).toThrow(`${a}`);",

    // Regex
    "expect(() => { throw new Error('a'); }).toThrow(/^a$/);",

    // Function
    "expect(() => { throw new Error('a'); })" +
      ".toThrow((() => { return 'a'; })());",

    // Allow no message for `not`.
    "expect(() => { throw new Error('a'); }).not.toThrow();",
  ],

  invalid: [
    // Empty toThrow
    {
      code: "expect(() => { throw new Error('a'); }).toThrow();",
      errors: [
        { message: 'Add an error message to toThrow()', column: 41, line: 1 },
      ],
    },
    // Empty toThrowError
    {
      code: "expect(() => { throw new Error('a'); }).toThrowError();",
      errors: [
        {
          message: 'Add an error message to toThrowError()',
          column: 41,
          line: 1,
        },
      ],
    },
  ],
});
