'use strict';

const RuleTester = require('eslint').RuleTester;
const rule = require('../no-jasmine-globals');

const ruleTester = new RuleTester();

ruleTester.run('no-jasmine-globals', rule, {
  valid: [
    'jest.spyOn()',
    'jest.fn()',
    'expect.extend()',
    'expect.any()',
    'it("foo", function () {})',
    'test("foo", function () {})',
    'foo()',
    `require('foo')('bar')`,
  ],
  invalid: [
    {
      code: 'spyOn(some, "object")',
      errors: [
        {
          message: 'Illegal usage of global `spyOn`, prefer `jest.spyOn`',
          column: 1,
          line: 1,
        },
      ],
    },
    {
      code: 'spyOnProperty(some, "object")',
      errors: [
        {
          message:
            'Illegal usage of global `spyOnProperty`, prefer `jest.spyOn`',
          column: 1,
          line: 1,
        },
      ],
    },
    {
      code: 'fail()',
      errors: [
        {
          message:
            'Illegal usage of `fail`, prefer throwing an error, or the `done.fail` callback',
          column: 1,
          line: 1,
        },
      ],
    },
    {
      code: 'pending()',
      errors: [
        {
          message:
            'Illegal usage of `pending`, prefer explicitly skipping a test using `test.skip`',
          column: 1,
          line: 1,
        },
      ],
    },
    {
      code: 'jasmine.DEFAULT_TIMEOUT_INTERVAL = 5000;',
      errors: [
        {
          message: 'Illegal usage of jasmine global',
          column: 1,
          line: 1,
        },
      ],
      output: 'jest.setTimeout(5000);',
    },
    {
      code: 'jasmine.addMatchers(matchers)',
      errors: [
        {
          message:
            'Illegal usage of `jasmine.addMatchers`, prefer `expect.extend`',
          column: 1,
          line: 1,
        },
      ],
    },
    {
      code: 'jasmine.createSpy()',
      errors: [
        {
          message: 'Illegal usage of `jasmine.createSpy`, prefer `jest.fn`',
          column: 1,
          line: 1,
        },
      ],
    },
    {
      code: 'jasmine.any()',
      errors: [
        {
          message: 'Illegal usage of `jasmine.any`, prefer `expect.any`',
          column: 1,
          line: 1,
        },
      ],
      output: 'expect.any()',
    },
    {
      code: 'jasmine.anything()',
      errors: [
        {
          message:
            'Illegal usage of `jasmine.anything`, prefer `expect.anything`',
          column: 1,
          line: 1,
        },
      ],
      output: 'expect.anything()',
    },
    {
      code: 'jasmine.arrayContaining()',
      errors: [
        {
          message:
            'Illegal usage of `jasmine.arrayContaining`, prefer `expect.arrayContaining`',
          column: 1,
          line: 1,
        },
      ],
      output: 'expect.arrayContaining()',
    },
    {
      code: 'jasmine.objectContaining()',
      errors: [
        {
          message:
            'Illegal usage of `jasmine.objectContaining`, prefer `expect.objectContaining`',
          column: 1,
          line: 1,
        },
      ],
      output: 'expect.objectContaining()',
    },
    {
      code: 'jasmine.stringMatching()',
      errors: [
        {
          message:
            'Illegal usage of `jasmine.stringMatching`, prefer `expect.stringMatching`',
          column: 1,
          line: 1,
        },
      ],
      output: 'expect.stringMatching()',
    },
    {
      code: 'jasmine.getEnv()',
      errors: [
        {
          message: 'Illegal usage of jasmine global',
          column: 1,
          line: 1,
        },
      ],
    },
    {
      code: 'jasmine.empty()',
      errors: [
        {
          message: 'Illegal usage of jasmine global',
          column: 1,
          line: 1,
        },
      ],
    },
    {
      code: 'jasmine.falsy()',
      errors: [
        {
          message: 'Illegal usage of jasmine global',
          column: 1,
          line: 1,
        },
      ],
    },
    {
      code: 'jasmine.truthy()',
      errors: [
        {
          message: 'Illegal usage of jasmine global',
          column: 1,
          line: 1,
        },
      ],
    },
    {
      code: 'jasmine.arrayWithExactContents()',
      errors: [
        {
          message: 'Illegal usage of jasmine global',
          column: 1,
          line: 1,
        },
      ],
    },
    {
      code: 'jasmine.clock()',
      errors: [
        {
          message: 'Illegal usage of jasmine global',
          column: 1,
          line: 1,
        },
      ],
    },
    {
      code: 'jasmine.MAX_PRETTY_PRINT_ARRAY_LENGTH = 42',
      errors: [
        {
          message: 'Illegal usage of jasmine global',
          column: 1,
          line: 1,
        },
      ],
    },
  ],
});
