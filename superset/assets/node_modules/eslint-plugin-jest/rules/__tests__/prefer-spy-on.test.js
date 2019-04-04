'use strict';

const RuleTester = require('eslint').RuleTester;
const rule = require('../prefer-spy-on');

const ruleTester = new RuleTester({
  parserOptions: {
    ecmaVersion: 6,
  },
});

ruleTester.run('prefer-spy-on', rule, {
  valid: [
    'Date.now = () => 10',
    'window.fetch = jest.fn',
    'Date.now = fn()',
    'obj.mock = jest.something()',
    'const mock = jest.fn()',
    'mock = jest.fn()',
    'const mockObj = { mock: jest.fn() }',
    'mockObj = { mock: jest.fn() }',
    'window[`${name}`] = jest[`fn${expression}`]()',
  ],
  invalid: [
    {
      code: 'obj.a = jest.fn(); const test = 10;',
      errors: [
        {
          message: 'Use jest.spyOn() instead.',
          type: 'AssignmentExpression',
        },
      ],
      output: "jest.spyOn(obj, 'a'); const test = 10;",
    },
    {
      code: "Date['now'] = jest['fn']()",
      errors: [
        {
          message: 'Use jest.spyOn() instead.',
          type: 'AssignmentExpression',
        },
      ],
      output: "jest.spyOn(Date, 'now')",
    },
    {
      code: 'window[`${name}`] = jest[`fn`]()',
      errors: [
        {
          message: 'Use jest.spyOn() instead.',
          type: 'AssignmentExpression',
        },
      ],
      output: 'jest.spyOn(window, `${name}`)',
    },
    {
      code: "obj['prop' + 1] = jest['fn']()",
      errors: [
        {
          message: 'Use jest.spyOn() instead.',
          type: 'AssignmentExpression',
        },
      ],
      output: "jest.spyOn(obj, 'prop' + 1)",
    },
    {
      code: 'obj.one.two = jest.fn(); const test = 10;',
      errors: [
        {
          message: 'Use jest.spyOn() instead.',
          type: 'AssignmentExpression',
        },
      ],
      output: "jest.spyOn(obj.one, 'two'); const test = 10;",
    },
    {
      code: 'obj.a = jest.fn(() => 10)',
      errors: [
        {
          message: 'Use jest.spyOn() instead.',
          type: 'AssignmentExpression',
        },
      ],
      output: "jest.spyOn(obj, 'a').mockImplementation(() => 10)",
    },
    {
      code:
        "obj.a.b = jest.fn(() => ({})).mockReturnValue('default').mockReturnValueOnce('first call'); test();",
      errors: [
        {
          message: 'Use jest.spyOn() instead.',
          type: 'AssignmentExpression',
        },
      ],
      output:
        "jest.spyOn(obj.a, 'b').mockImplementation(() => ({})).mockReturnValue('default').mockReturnValueOnce('first call'); test();",
    },
    {
      code: 'window.fetch = jest.fn(() => ({})).one.two().three().four',
      errors: [
        {
          message: 'Use jest.spyOn() instead.',
          type: 'AssignmentExpression',
        },
      ],
      output:
        "jest.spyOn(window, 'fetch').mockImplementation(() => ({})).one.two().three().four",
    },
  ],
});
