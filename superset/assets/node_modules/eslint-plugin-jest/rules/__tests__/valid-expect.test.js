'use strict';

const RuleTester = require('eslint').RuleTester;
const rule = require('../valid-expect');

const ruleTester = new RuleTester();

ruleTester.run('valid-expect', rule, {
  valid: [
    'expect("something").toEqual("else");',
    'expect(true).toBeDefined();',
    'expect([1, 2, 3]).toEqual([1, 2, 3]);',
    'expect(undefined).not.toBeDefined();',
    'expect(Promise.resolve(2)).resolves.toBeDefined();',
    'expect(Promise.reject(2)).rejects.toBeDefined();',
  ],

  invalid: [
    {
      code: 'expect().toBe(true);',
      errors: [
        {
          endColumn: 8,
          column: 7,
          message: 'No arguments were passed to expect().',
        },
      ],
    },
    {
      code: 'expect().toEqual("something");',
      errors: [
        {
          endColumn: 8,
          column: 7,
          message: 'No arguments were passed to expect().',
        },
      ],
    },
    {
      code: 'expect("something", "else").toEqual("something");',
      errors: [
        {
          endColumn: 26,
          column: 21,
          message: 'More than one argument was passed to expect().',
        },
      ],
    },
    {
      code: 'expect("something");',
      errors: [
        {
          endColumn: 20,
          column: 1,
          message: 'No assertion was called on expect().',
        },
      ],
    },
    {
      code: 'expect();',
      errors: [
        {
          endColumn: 9,
          column: 1,
          message: 'No assertion was called on expect().',
        },
        {
          endColumn: 8,
          column: 7,
          message: 'No arguments were passed to expect().',
        },
      ],
    },
    {
      code: 'expect(true).toBeDefined;',
      errors: [
        {
          endColumn: 25,
          column: 14,
          message: '"toBeDefined" was not called.',
        },
      ],
    },
    {
      code: 'expect(true).not.toBeDefined;',
      errors: [
        {
          endColumn: 29,
          column: 18,
          message: '"toBeDefined" was not called.',
        },
      ],
    },
    {
      code: 'expect(true).nope.toBeDefined;',
      errors: [
        {
          endColumn: 18,
          column: 14,
          message: '"nope" is not a valid property of expect.',
        },
      ],
    },
    {
      code: 'expect(true).resolves;',
      errors: [
        {
          endColumn: 22,
          column: 14,
          message: '"resolves" needs to call a matcher.',
        },
      ],
    },
    {
      code: 'expect(true).rejects;',
      errors: [
        {
          endColumn: 21,
          column: 14,
          message: '"rejects" needs to call a matcher.',
        },
      ],
    },
    {
      code: 'expect(true).not;',
      errors: [
        {
          endColumn: 17,
          column: 14,
          message: '"not" needs to call a matcher.',
        },
      ],
    },
  ],
});
