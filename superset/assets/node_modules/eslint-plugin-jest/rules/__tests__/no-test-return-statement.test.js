'use strict';

const RuleTester = require('eslint').RuleTester;
const rule = require('../no-test-return-statement');

const ruleTester = new RuleTester({ parserOptions: { ecmaVersion: 2015 } });

ruleTester.run('no-test-prefixes', rule, {
  valid: [
    'it("noop", function () {});',
    'test("noop", () => {});',
    'test("one", () => expect(1).toBe(1));',
    'test("empty")',
    `
    test("one", () => {
      expect(1).toBe(1);
    });
    `,
    `
    it("one", function () {
      expect(1).toBe(1);
    });
    `,
  ],
  invalid: [
    {
      code: `
      test("one", () => {
        return expect(1).toBe(1);
      });
      `,
      errors: [
        {
          message: 'Jest tests should not return a value.',
          column: 9,
          line: 3,
        },
      ],
    },
    {
      code: `
      it("one", function () {
        return expect(1).toBe(1);
      });
      `,
      errors: [
        {
          message: 'Jest tests should not return a value.',
          column: 9,
          line: 3,
        },
      ],
    },
  ],
});
