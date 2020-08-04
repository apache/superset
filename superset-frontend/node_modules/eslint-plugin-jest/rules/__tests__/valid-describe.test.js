'use strict';

const RuleTester = require('eslint').RuleTester;
const rule = require('../valid-describe');

const ruleTester = new RuleTester({
  parserOptions: {
    ecmaVersion: 8,
  },
});

ruleTester.run('valid-describe', rule, {
  valid: [
    'describe("foo", function() {})',
    'describe("foo", () => {})',
    'describe(`foo`, () => {})',
    'xdescribe("foo", () => {})',
    'fdescribe("foo", () => {})',
    'describe.only("foo", () => {})',
    'describe.skip("foo", () => {})',
    `
    describe('foo', () => {
      it('bar', () => {
        return Promise.resolve(42).then(value => {
          expect(value).toBe(42)
        })
      })
    })
    `,
    `
    describe('foo', () => {
      it('bar', async () => {
        expect(await Promise.resolve(42)).toBe(42)
      })
    })
    `,
    `
    describe('foo', () =>
      test('bar', () => {})
    )
    `,
  ],
  invalid: [
    {
      code: 'describe(() => {})',
      errors: [
        {
          message: 'First argument must be name',
          line: 1,
          column: 10,
        },
        {
          message: 'Describe requires name and callback arguments',
          line: 1,
          column: 10,
        },
      ],
    },
    {
      code: 'describe("foo")',
      errors: [
        {
          message: 'Describe requires name and callback arguments',
          line: 1,
          column: 10,
        },
      ],
    },
    {
      code: 'describe("foo", "foo2")',
      errors: [
        {
          message: 'Second argument must be function',
          line: 1,
          column: 10,
        },
      ],
    },
    {
      code: 'describe()',
      errors: [
        {
          message: 'Describe requires name and callback arguments',
          line: 1,
          column: 1,
        },
      ],
    },
    {
      code: 'describe("foo", async () => {})',
      errors: [{ message: 'No async describe callback', line: 1, column: 17 }],
    },
    {
      code: 'describe("foo", async function () {})',
      errors: [{ message: 'No async describe callback', line: 1, column: 17 }],
    },
    {
      code: 'xdescribe("foo", async function () {})',
      errors: [{ message: 'No async describe callback', line: 1, column: 18 }],
    },
    {
      code: 'fdescribe("foo", async function () {})',
      errors: [{ message: 'No async describe callback', line: 1, column: 18 }],
    },
    {
      code: 'describe.only("foo", async function () {})',
      errors: [{ message: 'No async describe callback', line: 1, column: 22 }],
    },
    {
      code: 'describe.skip("foo", async function () {})',
      errors: [{ message: 'No async describe callback', line: 1, column: 22 }],
    },
    {
      code: `
      describe('sample case', () => {
        it('works', () => {
          expect(true).toEqual(true);
        });
        describe('async', async () => {
          await new Promise(setImmediate);
          it('breaks', () => {
            throw new Error('Fail');
          });
        });
      });`,
      errors: [{ message: 'No async describe callback', line: 6, column: 27 }],
    },
    {
      code: `
      describe('foo', function () {
        return Promise.resolve().then(() => {
          it('breaks', () => {
            throw new Error('Fail')
          })
        })
      })
      `,
      errors: [
        {
          message: 'Unexpected return statement in describe callback',
          line: 3,
          column: 9,
        },
      ],
    },
    {
      code: `
      describe('foo', () => {
        return Promise.resolve().then(() => {
          it('breaks', () => {
            throw new Error('Fail')
          })
        })
        describe('nested', () => {
          return Promise.resolve().then(() => {
            it('breaks', () => {
              throw new Error('Fail')
            })
          })
        })
      })
      `,
      errors: [
        {
          message: 'Unexpected return statement in describe callback',
          line: 3,
          column: 9,
        },
        {
          message: 'Unexpected return statement in describe callback',
          line: 9,
          column: 11,
        },
      ],
    },
    {
      code: `
      describe('foo', async () => {
        await something()
        it('does something')
        describe('nested', () => {
          return Promise.resolve().then(() => {
            it('breaks', () => {
              throw new Error('Fail')
            })
          })
        })
      })
      `,
      errors: [
        {
          message: 'No async describe callback',
          line: 2,
          column: 23,
        },
        {
          message: 'Unexpected return statement in describe callback',
          line: 6,
          column: 11,
        },
      ],
    },
    {
      code: 'describe("foo", done => {})',
      errors: [
        {
          message: 'Unexpected argument(s) in describe callback',
          line: 1,
          column: 17,
        },
      ],
    },
    {
      code: 'describe("foo", function (done) {})',
      errors: [
        {
          message: 'Unexpected argument(s) in describe callback',
          line: 1,
          column: 27,
        },
      ],
    },
    {
      code: 'describe("foo", function (one, two, three) {})',
      errors: [
        {
          message: 'Unexpected argument(s) in describe callback',
          line: 1,
          column: 27,
        },
      ],
    },
    {
      code: 'describe("foo", async function (done) {})',
      errors: [
        { message: 'No async describe callback', line: 1, column: 17 },
        {
          message: 'Unexpected argument(s) in describe callback',
          line: 1,
          column: 33,
        },
      ],
    },
  ],
});
