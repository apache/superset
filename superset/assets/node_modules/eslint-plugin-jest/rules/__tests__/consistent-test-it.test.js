'use strict';

const RuleTester = require('eslint').RuleTester;
const rule = require('../consistent-test-it');

const ruleTester = new RuleTester({
  parserOptions: {
    ecmaVersion: 6,
  },
});

ruleTester.run('consistent-test-it with fn=test', rule, {
  valid: [
    {
      code: 'test("foo")',
      options: [{ fn: 'test' }],
    },
    {
      code: 'test.only("foo")',
      options: [{ fn: 'test' }],
    },
    {
      code: 'test.skip("foo")',
      options: [{ fn: 'test' }],
    },
    {
      code: 'xtest("foo")',
      options: [{ fn: 'test' }],
    },
    {
      code: 'describe("suite", () => { test("foo") })',
      options: [{ fn: 'test' }],
    },
  ],
  invalid: [
    {
      code: 'it("foo")',
      options: [{ fn: 'test' }],
      errors: [{ message: "Prefer using 'test' instead of 'it'" }],
      output: 'test("foo")',
    },
    {
      code: 'xit("foo")',
      options: [{ fn: 'test' }],
      errors: [{ message: "Prefer using 'test' instead of 'it'" }],
      output: 'xtest("foo")',
    },
    {
      code: 'fit("foo")',
      options: [{ fn: 'test' }],
      errors: [{ message: "Prefer using 'test' instead of 'it'" }],
      output: 'test.only("foo")',
    },
    {
      code: 'it.skip("foo")',
      options: [{ fn: 'test' }],
      errors: [{ message: "Prefer using 'test' instead of 'it'" }],
      output: 'test.skip("foo")',
    },
    {
      code: 'it.only("foo")',
      options: [{ fn: 'test' }],
      errors: [{ message: "Prefer using 'test' instead of 'it'" }],
      output: 'test.only("foo")',
    },
    {
      code: 'describe("suite", () => { it("foo") })',
      options: [{ fn: 'test' }],
      errors: [
        { message: "Prefer using 'test' instead of 'it' within describe" },
      ],
      output: 'describe("suite", () => { test("foo") })',
    },
  ],
});

ruleTester.run('consistent-test-it with fn=it', rule, {
  valid: [
    {
      code: 'it("foo")',
      options: [{ fn: 'it' }],
    },
    {
      code: 'fit("foo")',
      options: [{ fn: 'it' }],
    },
    {
      code: 'xit("foo")',
      options: [{ fn: 'it' }],
    },
    {
      code: 'it.only("foo")',
      options: [{ fn: 'it' }],
    },
    {
      code: 'it.skip("foo")',
      options: [{ fn: 'it' }],
    },
    {
      code: 'describe("suite", () => { it("foo") })',
      options: [{ fn: 'it' }],
    },
  ],
  invalid: [
    {
      code: 'test("foo")',
      options: [{ fn: 'it' }],
      errors: [{ message: "Prefer using 'it' instead of 'test'" }],
      output: 'it("foo")',
    },
    {
      code: 'xtest("foo")',
      options: [{ fn: 'it' }],
      errors: [{ message: "Prefer using 'it' instead of 'test'" }],
      output: 'xit("foo")',
    },
    {
      code: 'test.skip("foo")',
      options: [{ fn: 'it' }],
      errors: [{ message: "Prefer using 'it' instead of 'test'" }],
      output: 'it.skip("foo")',
    },
    {
      code: 'test.only("foo")',
      options: [{ fn: 'it' }],
      errors: [{ message: "Prefer using 'it' instead of 'test'" }],
      output: 'it.only("foo")',
    },
    {
      code: 'describe("suite", () => { test("foo") })',
      options: [{ fn: 'it' }],
      errors: [
        { message: "Prefer using 'it' instead of 'test' within describe" },
      ],
      output: 'describe("suite", () => { it("foo") })',
    },
  ],
});

ruleTester.run('consistent-test-it with fn=test and withinDescribe=it ', rule, {
  valid: [
    {
      code: 'test("foo")',
      options: [{ fn: 'test', withinDescribe: 'it' }],
    },
    {
      code: 'test.only("foo")',
      options: [{ fn: 'test', withinDescribe: 'it' }],
    },
    {
      code: 'test.skip("foo")',
      options: [{ fn: 'test', withinDescribe: 'it' }],
    },
    {
      code: 'xtest("foo")',
      options: [{ fn: 'test', withinDescribe: 'it' }],
    },
    {
      code: '[1,2,3].forEach(() => { test("foo") })',
      options: [{ fn: 'test', withinDescribe: 'it' }],
    },
  ],
  invalid: [
    {
      code: 'describe("suite", () => { test("foo") })',
      options: [{ fn: 'test', withinDescribe: 'it' }],
      errors: [
        { message: "Prefer using 'it' instead of 'test' within describe" },
      ],
      output: 'describe("suite", () => { it("foo") })',
    },
    {
      code: 'describe("suite", () => { test.only("foo") })',
      options: [{ fn: 'test', withinDescribe: 'it' }],
      errors: [
        { message: "Prefer using 'it' instead of 'test' within describe" },
      ],
      output: 'describe("suite", () => { it.only("foo") })',
    },
    {
      code: 'describe("suite", () => { xtest("foo") })',
      options: [{ fn: 'test', withinDescribe: 'it' }],
      errors: [
        { message: "Prefer using 'it' instead of 'test' within describe" },
      ],
      output: 'describe("suite", () => { xit("foo") })',
    },
    {
      code: 'describe("suite", () => { test.skip("foo") })',
      options: [{ fn: 'test', withinDescribe: 'it' }],
      errors: [
        { message: "Prefer using 'it' instead of 'test' within describe" },
      ],
      output: 'describe("suite", () => { it.skip("foo") })',
    },
  ],
});

ruleTester.run('consistent-test-it with fn=it and withinDescribe=test ', rule, {
  valid: [
    {
      code: 'it("foo")',
      options: [{ fn: 'it', withinDescribe: 'test' }],
    },
    {
      code: 'it.only("foo")',
      options: [{ fn: 'it', withinDescribe: 'test' }],
    },
    {
      code: 'it.skip("foo")',
      options: [{ fn: 'it', withinDescribe: 'test' }],
    },
    {
      code: 'xit("foo")',
      options: [{ fn: 'it', withinDescribe: 'test' }],
    },
    {
      code: '[1,2,3].forEach(() => { it("foo") })',
      options: [{ fn: 'it', withinDescribe: 'test' }],
    },
  ],
  invalid: [
    {
      code: 'describe("suite", () => { it("foo") })',
      options: [{ fn: 'it', withinDescribe: 'test' }],
      errors: [
        { message: "Prefer using 'test' instead of 'it' within describe" },
      ],
      output: 'describe("suite", () => { test("foo") })',
    },
    {
      code: 'describe("suite", () => { it.only("foo") })',
      options: [{ fn: 'it', withinDescribe: 'test' }],
      errors: [
        { message: "Prefer using 'test' instead of 'it' within describe" },
      ],
      output: 'describe("suite", () => { test.only("foo") })',
    },
    {
      code: 'describe("suite", () => { xit("foo") })',
      options: [{ fn: 'it', withinDescribe: 'test' }],
      errors: [
        { message: "Prefer using 'test' instead of 'it' within describe" },
      ],
      output: 'describe("suite", () => { xtest("foo") })',
    },
    {
      code: 'describe("suite", () => { it.skip("foo") })',
      options: [{ fn: 'it', withinDescribe: 'test' }],
      errors: [
        { message: "Prefer using 'test' instead of 'it' within describe" },
      ],
      output: 'describe("suite", () => { test.skip("foo") })',
    },
  ],
});

ruleTester.run(
  'consistent-test-it with fn=test and withinDescribe=test ',
  rule,
  {
    valid: [
      {
        code: 'describe("suite", () => { test("foo") })',
        options: [{ fn: 'test', withinDescribe: 'test' }],
      },
      {
        code: 'test("foo");',
        options: [{ fn: 'test', withinDescribe: 'test' }],
      },
    ],
    invalid: [
      {
        code: 'describe("suite", () => { it("foo") })',
        options: [{ fn: 'test', withinDescribe: 'test' }],
        errors: [
          { message: "Prefer using 'test' instead of 'it' within describe" },
        ],
        output: 'describe("suite", () => { test("foo") })',
      },
      {
        code: 'it("foo")',
        options: [{ fn: 'test', withinDescribe: 'test' }],
        errors: [{ message: "Prefer using 'test' instead of 'it'" }],
        output: 'test("foo")',
      },
    ],
  }
);

ruleTester.run('consistent-test-it with fn=it and withinDescribe=it ', rule, {
  valid: [
    {
      code: 'describe("suite", () => { it("foo") })',
      options: [{ fn: 'it', withinDescribe: 'it' }],
    },
    {
      code: 'it("foo")',
      options: [{ fn: 'it', withinDescribe: 'it' }],
    },
  ],
  invalid: [
    {
      code: 'describe("suite", () => { test("foo") })',
      options: [{ fn: 'it', withinDescribe: 'it' }],
      errors: [
        { message: "Prefer using 'it' instead of 'test' within describe" },
      ],
      output: 'describe("suite", () => { it("foo") })',
    },
    {
      code: 'test("foo")',
      options: [{ fn: 'it', withinDescribe: 'it' }],
      errors: [{ message: "Prefer using 'it' instead of 'test'" }],
      output: 'it("foo")',
    },
  ],
});

ruleTester.run('consistent-test-it defaults without config object', rule, {
  valid: [
    {
      code: 'test("foo")',
    },
  ],
  invalid: [
    {
      code: 'describe("suite", () => { test("foo") })',
      errors: [
        { message: "Prefer using 'it' instead of 'test' within describe" },
      ],
      output: 'describe("suite", () => { it("foo") })',
    },
  ],
});

ruleTester.run('consistent-test-it with withinDescribe=it', rule, {
  valid: [
    {
      code: 'test("foo")',
      options: [{ withinDescribe: 'it' }],
    },
    {
      code: 'describe("suite", () => { it("foo") })',
      options: [{ withinDescribe: 'it' }],
    },
  ],
  invalid: [
    {
      code: 'it("foo")',
      options: [{ withinDescribe: 'it' }],
      errors: [{ message: "Prefer using 'test' instead of 'it'" }],
      output: 'test("foo")',
    },
    {
      code: 'describe("suite", () => { test("foo") })',
      options: [{ withinDescribe: 'it' }],
      errors: [
        { message: "Prefer using 'it' instead of 'test' within describe" },
      ],
      output: 'describe("suite", () => { it("foo") })',
    },
  ],
});

ruleTester.run('consistent-test-it with withinDescribe=test', rule, {
  valid: [
    {
      code: 'test("foo")',
      options: [{ withinDescribe: 'test' }],
    },
    {
      code: 'describe("suite", () => { test("foo") })',
      options: [{ withinDescribe: 'test' }],
    },
  ],
  invalid: [
    {
      code: 'it("foo")',
      options: [{ withinDescribe: 'test' }],
      errors: [{ message: "Prefer using 'test' instead of 'it'" }],
      output: 'test("foo")',
    },
    {
      code: 'describe("suite", () => { it("foo") })',
      options: [{ withinDescribe: 'test' }],
      errors: [
        { message: "Prefer using 'test' instead of 'it' within describe" },
      ],
      output: 'describe("suite", () => { test("foo") })',
    },
  ],
});
