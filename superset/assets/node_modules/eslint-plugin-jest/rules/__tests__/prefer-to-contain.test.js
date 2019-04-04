'use strict';

const RuleTester = require('eslint').RuleTester;
const rule = require('../prefer-to-contain');

const ruleTester = new RuleTester();

ruleTester.run('prefer-to-contain', rule, {
  valid: [
    'expect(a).toContain(b);',
    "expect(a.name).toBe('b');",
    'expect(a).toBe(true);',
    `expect(a).toEqual(b)`,
    `expect(a.test(c)).toEqual(b)`,
    `expect(a.includes(b)).toEqual()`,
    `expect(a.includes(b)).toEqual("test")`,
    `expect(a.includes(b)).toBe("test")`,
    `expect(a.includes()).toEqual()`,
    `expect(a.includes()).toEqual(true)`,
    `expect(a.includes(b,c)).toBe(true)`,
    `expect([{a:1}]).toContain({a:1})`,
    `expect([1].includes(1)).toEqual`,
    `expect([1].includes).toEqual`,
    `expect([1].includes).not`,
    `expect(a.test(b)).resolves.toEqual(true)`,
    `expect(a.test(b)).resolves.not.toEqual(true)`,
    `expect(a).not.toContain(b)`,
  ],
  invalid: [
    {
      code: 'expect(a.includes(b)).toEqual(true);',
      errors: [
        {
          message: 'Use toContain() instead',
          column: 23,
          line: 1,
        },
      ],
      output: 'expect(a).toContain(b);',
    },
    {
      code: 'expect(a.includes(b)).toEqual(false);',
      errors: [
        {
          message: 'Use toContain() instead',
          column: 23,
          line: 1,
        },
      ],
      output: 'expect(a).not.toContain(b);',
    },
    {
      code: 'expect(a.includes(b)).not.toEqual(false);',
      errors: [
        {
          message: 'Use toContain() instead',
          column: 23,
          line: 1,
        },
      ],
      output: 'expect(a).toContain(b);',
    },
    {
      code: 'expect(a.includes(b)).not.toEqual(true);',
      errors: [
        {
          message: 'Use toContain() instead',
          column: 23,
          line: 1,
        },
      ],
      output: 'expect(a).not.toContain(b);',
    },
    {
      code: 'expect(a.includes(b)).toBe(true);',
      errors: [
        {
          message: 'Use toContain() instead',
          column: 23,
          line: 1,
        },
      ],
      output: 'expect(a).toContain(b);',
    },
    {
      code: 'expect(a.includes(b)).toBe(false);',
      errors: [
        {
          message: 'Use toContain() instead',
          column: 23,
          line: 1,
        },
      ],
      output: 'expect(a).not.toContain(b);',
    },
    {
      code: 'expect(a.includes(b)).not.toBe(false);',
      errors: [
        {
          message: 'Use toContain() instead',
          column: 23,
          line: 1,
        },
      ],
      output: 'expect(a).toContain(b);',
    },
    {
      code: 'expect(a.includes(b)).not.toBe(true);',
      errors: [
        {
          message: 'Use toContain() instead',
          column: 23,
          line: 1,
        },
      ],
      output: 'expect(a).not.toContain(b);',
    },
    {
      code: 'expect(a.test(t).includes(b.test(p))).toEqual(true);',
      errors: [
        {
          message: 'Use toContain() instead',
          column: 39,
          line: 1,
        },
      ],
      output: 'expect(a.test(t)).toContain(b.test(p));',
    },
    {
      code: 'expect(a.test(t).includes(b.test(p))).toEqual(false);',
      errors: [
        {
          message: 'Use toContain() instead',
          column: 39,
          line: 1,
        },
      ],
      output: 'expect(a.test(t)).not.toContain(b.test(p));',
    },
    {
      code: 'expect(a.test(t).includes(b.test(p))).not.toEqual(true);',
      errors: [
        {
          message: 'Use toContain() instead',
          column: 39,
          line: 1,
        },
      ],
      output: 'expect(a.test(t)).not.toContain(b.test(p));',
    },
    {
      code: 'expect(a.test(t).includes(b.test(p))).not.toEqual(false);',
      errors: [
        {
          message: 'Use toContain() instead',
          column: 39,
          line: 1,
        },
      ],
      output: 'expect(a.test(t)).toContain(b.test(p));',
    },
    {
      code: 'expect([{a:1}].includes({a:1})).toBe(true);',
      errors: [
        {
          message: 'Use toContain() instead',
          column: 33,
          line: 1,
        },
      ],
      output: 'expect([{a:1}]).toContain({a:1});',
    },
    {
      code: 'expect([{a:1}].includes({a:1})).toBe(false);',
      errors: [
        {
          message: 'Use toContain() instead',
          column: 33,
          line: 1,
        },
      ],
      output: 'expect([{a:1}]).not.toContain({a:1});',
    },
    {
      code: 'expect([{a:1}].includes({a:1})).not.toBe(true);',
      errors: [
        {
          message: 'Use toContain() instead',
          column: 33,
          line: 1,
        },
      ],
      output: 'expect([{a:1}]).not.toContain({a:1});',
    },
    {
      code: 'expect([{a:1}].includes({a:1})).not.toBe(false);',
      errors: [
        {
          message: 'Use toContain() instead',
          column: 33,
          line: 1,
        },
      ],
      output: 'expect([{a:1}]).toContain({a:1});',
    },
  ],
});
