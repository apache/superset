'use strict';

const RuleTester = require('eslint').RuleTester;
const rule = require('../no-alias-methods');

const ruleTester = new RuleTester();

ruleTester.run('no-alias-methods', rule, {
  valid: [
    'expect(a).toHaveBeenCalled()',
    'expect(a).toHaveBeenCalledTimes()',
    'expect(a).toHaveBeenCalledWith()',
    'expect(a).toHaveBeenLastCalledWith()',
    'expect(a).toHaveBeenNthCalledWith()',
    'expect(a).toHaveReturned()',
    'expect(a).toHaveReturnedTimes()',
    'expect(a).toHaveReturnedWith()',
    'expect(a).toHaveLastReturnedWith()',
    'expect(a).toHaveNthReturnedWith()',
    'expect(a).toThrow()',
  ],

  invalid: [
    {
      code: 'expect(a).toBeCalled()',
      errors: [
        {
          message:
            'Replace toBeCalled() with its canonical name of toHaveBeenCalled()',
          column: 11,
          line: 1,
        },
      ],
      output: 'expect(a).toHaveBeenCalled()',
    },
    {
      code: 'expect(a).toBeCalledTimes()',
      errors: [
        {
          message:
            'Replace toBeCalledTimes() with its canonical name of toHaveBeenCalledTimes()',
          column: 11,
          line: 1,
        },
      ],
      output: 'expect(a).toHaveBeenCalledTimes()',
    },
    {
      code: 'expect(a).toBeCalledWith()',
      errors: [
        {
          message:
            'Replace toBeCalledWith() with its canonical name of toHaveBeenCalledWith()',
          column: 11,
          line: 1,
        },
      ],
      output: 'expect(a).toHaveBeenCalledWith()',
    },
    {
      code: 'expect(a).lastCalledWith()',
      errors: [
        {
          message:
            'Replace lastCalledWith() with its canonical name of toHaveBeenLastCalledWith()',
          column: 11,
          line: 1,
        },
      ],
      output: 'expect(a).toHaveBeenLastCalledWith()',
    },
    {
      code: 'expect(a).nthCalledWith()',
      errors: [
        {
          message:
            'Replace nthCalledWith() with its canonical name of toHaveBeenNthCalledWith()',
          column: 11,
          line: 1,
        },
      ],
      output: 'expect(a).toHaveBeenNthCalledWith()',
    },
    {
      code: 'expect(a).toReturn()',
      errors: [
        {
          message:
            'Replace toReturn() with its canonical name of toHaveReturned()',
          column: 11,
          line: 1,
        },
      ],
      output: 'expect(a).toHaveReturned()',
    },
    {
      code: 'expect(a).toReturnTimes()',
      errors: [
        {
          message:
            'Replace toReturnTimes() with its canonical name of toHaveReturnedTimes()',
          column: 11,
          line: 1,
        },
      ],
      output: 'expect(a).toHaveReturnedTimes()',
    },
    {
      code: 'expect(a).toReturnWith()',
      errors: [
        {
          message:
            'Replace toReturnWith() with its canonical name of toHaveReturnedWith()',
          column: 11,
          line: 1,
        },
      ],
      output: 'expect(a).toHaveReturnedWith()',
    },
    {
      code: 'expect(a).lastReturnedWith()',
      errors: [
        {
          message:
            'Replace lastReturnedWith() with its canonical name of toHaveLastReturnedWith()',
          column: 11,
          line: 1,
        },
      ],
      output: 'expect(a).toHaveLastReturnedWith()',
    },
    {
      code: 'expect(a).nthReturnedWith()',
      errors: [
        {
          message:
            'Replace nthReturnedWith() with its canonical name of toHaveNthReturnedWith()',
          column: 11,
          line: 1,
        },
      ],
      output: 'expect(a).toHaveNthReturnedWith()',
    },
    {
      code: 'expect(a).toThrowError()',
      errors: [
        {
          message:
            'Replace toThrowError() with its canonical name of toThrow()',
          column: 11,
          line: 1,
        },
      ],
      output: 'expect(a).toThrow()',
    },
  ],
});
