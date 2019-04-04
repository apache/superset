'use strict';

const RuleTester = require('eslint').RuleTester;
const rule = require('../prefer-expect-assertions');

const ruleTester = new RuleTester({
  parserOptions: {
    ecmaVersion: 6,
  },
});

const expectedMsg =
  'Every test should have either `expect.assertions(<number of assertions>)` or `expect.hasAssertions()` as its first expression';

ruleTester.run('prefer-expect-assertions', rule, {
  invalid: [
    {
      code: 'it("it1", () => {})',
      errors: [
        {
          message: expectedMsg,
        },
      ],
    },
    {
      code: 'it("it1", () => { foo()})',
      errors: [
        {
          message: expectedMsg,
        },
      ],
    },
    {
      code:
        'it("it1", function() {' +
        '\n\t\t\tsomeFunctionToDo();' +
        '\n\t\t\tsomeFunctionToDo2();\n' +
        '\t\t\t})',
      errors: [
        {
          message: expectedMsg,
        },
      ],
    },
    {
      code: 'it("it1", function() {var a = 2;})',
      errors: [
        {
          message: expectedMsg,
        },
      ],
    },
    {
      code: 'it("it1", function() {expect.assertions();})',
      errors: [
        {
          message: expectedMsg,
        },
      ],
    },
    {
      code: 'it("it1", function() {expect.assertions(1,2);})',
      errors: [
        {
          message: expectedMsg,
        },
      ],
    },
    {
      code: 'it("it1", function() {expect.assertions("1");})',
      errors: [
        {
          message: expectedMsg,
        },
      ],
    },
  ],

  valid: [
    {
      code: 'test("it1", () => {expect.assertions(0);})',
    },
    'test("it1", function() {expect.assertions(0);})',
    'test("it1", function() {expect.hasAssertions();})',
    'it("it1", function() {expect.assertions(0);})',
    'it("it1", function() {\n\t\t\texpect.assertions(1);' +
      '\n\t\t\texpect(someValue).toBe(true)\n' +
      '\t\t\t})',
    'test("it1")',
    'itHappensToStartWithIt("foo", function() {})',
    'testSomething("bar", function() {})',
  ],
});
