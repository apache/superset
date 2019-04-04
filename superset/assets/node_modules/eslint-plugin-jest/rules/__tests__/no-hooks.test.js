'use strict';

const RuleTester = require('eslint').RuleTester;
const rule = require('../no-hooks');

const ruleTester = new RuleTester({
  parserOptions: {
    ecmaVersion: 6,
  },
});

ruleTester.run('no-hooks', rule, {
  valid: [
    'test("foo")',
    'describe("foo", () => { it("bar") })',
    'test("foo", () => { expect(subject.beforeEach()).toBe(true) })',
    {
      code: 'afterEach(() => {}); afterAll(() => {});',
      options: [{ allow: ['afterEach', 'afterAll'] }],
    },
  ],
  invalid: [
    {
      code: 'beforeAll(() => {})',
      errors: [{ message: "Unexpected 'beforeAll' hook" }],
    },
    {
      code: 'beforeEach(() => {})',
      errors: [{ message: "Unexpected 'beforeEach' hook" }],
    },
    {
      code: 'afterAll(() => {})',
      errors: [{ message: "Unexpected 'afterAll' hook" }],
    },
    {
      code: 'afterEach(() => {})',
      errors: [{ message: "Unexpected 'afterEach' hook" }],
    },
    {
      code: 'beforeEach(() => {}); afterEach(() => { jest.resetModules() });',
      options: [{ allow: ['afterEach'] }],
      errors: [{ message: "Unexpected 'beforeEach' hook" }],
    },
  ],
});
