'use strict';

const RuleTester = require('eslint').RuleTester;
const rule = require('../expect-expect');

const ruleTester = new RuleTester({
  parserOptions: {
    ecmaVersion: 6,
  },
});

ruleTester.run('expect-expect', rule, {
  valid: [
    'it("should pass", () => expect(true).toBeDefined())',
    'test("should pass", () => expect(true).toBeDefined())',
    'it("should pass", () => somePromise().then(() => expect(true).toBeDefined()))',
    {
      code:
        'test("should pass", () => { expect(true).toBeDefined(); foo(true).toBe(true); })',
      options: [{ assertFunctionNames: ['expect', 'foo'] }],
    },
    {
      code: 'it("should return undefined",() => expectSaga(mySaga).returns());',
      options: [{ assertFunctionNames: ['expectSaga'] }],
    },
    {
      code: [
        'test("verifies the function call", () => {',
        '  td.verify(someFunctionCall())',
        '})',
      ].join('\n'),
      options: [{ assertFunctionNames: ['td.verify'] }],
    },
  ],

  invalid: [
    {
      code: 'it("should fail", () => {});',
      errors: [
        {
          message: 'Test has no assertions',
          type: 'CallExpression',
        },
      ],
    },
    {
      code: 'test("should fail", () => {});',
      errors: [
        {
          message: 'Test has no assertions',
          type: 'CallExpression',
        },
      ],
    },
    {
      code: 'it("should fail", () => { somePromise.then(() => {}); });',
      errors: [
        {
          message: 'Test has no assertions',
          type: 'CallExpression',
        },
      ],
    },
    {
      code: 'test("should fail", () => { foo(true).toBe(true); })',
      options: [{ assertFunctionNames: ['expect'] }],
      errors: [
        {
          message: 'Test has no assertions',
          type: 'CallExpression',
        },
      ],
    },
    {
      code: 'it("should also fail",() => expectSaga(mySaga).returns());',
      options: [{ assertFunctionNames: ['expect'] }],
      errors: [
        {
          message: 'Test has no assertions',
          type: 'CallExpression',
        },
      ],
    },
  ],
});
