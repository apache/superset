'use strict';

const RuleTester = require('eslint').RuleTester;
const rule = require('../valid-expect-in-promise');

const ruleTester = new RuleTester({
  parserOptions: {
    ecmaVersion: 8,
  },
});

const expectedMsg =
  'Promise should be returned to test its fulfillment or rejection';

ruleTester.run('valid-expect-in-promise', rule, {
  invalid: [
    {
      code: `
         it('it1', () => {
           somePromise.then(() => {
             expect(someThing).toEqual(true);
           });
         });
      `,
      errors: [
        {
          column: 12,
          endColumn: 15,
          message: expectedMsg,
        },
      ],
    },
    {
      code: `
        it('it1', function() {
            getSomeThing().getPromise().then(function() {
              expect(someThing).toEqual(true);
            });
        });
      `,
      errors: [
        {
          column: 13,
          endColumn: 16,
          message: expectedMsg,
        },
      ],
    },
    {
      code: `
        it('it1', function() {
            Promise.resolve().then(function() {
              expect(someThing).toEqual(true);
            });
          });
      `,
      errors: [
        {
          column: 13,
          endColumn: 16,
          message: expectedMsg,
        },
      ],
    },
    {
      code: `
        it('it1', function() {
            somePromise.catch(function() {
              expect(someThing).toEqual(true)
            })
          }
        )
      `,
      errors: [
        {
          column: 13,
          endColumn: 15,
          message: expectedMsg,
        },
      ],
    },
    {
      code: `
        it('it1', function() {
            somePromise.then(function() {
              expect(someThing).toEqual(true)
            })
          }
        )
      `,
      errors: [
        {
          column: 13,
          endColumn: 15,
          message: expectedMsg,
        },
      ],
    },
    {
      code: `
        it('it1', function () {
          Promise.resolve().then(/*fulfillment*/ function () {
            expect(someThing).toEqual(true);
          }, /*rejection*/ function () {
            expect(someThing).toEqual(true);
          })
        })
      `,
      errors: [
        {
          column: 11,
          endColumn: 13,
          message: expectedMsg,
        },
      ],
    },
    {
      code: `
        it('it1', function () {
          Promise.resolve().then(/*fulfillment*/ function () {
          }, /*rejection*/ function () {
            expect(someThing).toEqual(true)
          })
        });
      `,
      errors: [
        {
          column: 11,
          endColumn: 13,
          message: expectedMsg,
        },
      ],
    },
    {
      code: `
        it('test function', () => {
          Builder.getPromiseBuilder().get().build().then((data) => expect(data).toEqual('Hi'));
        });
      `,
      errors: [
        {
          column: 11,
          endColumn: 96,
          message: expectedMsg,
        },
      ],
    },
    {
      code: `
        it('it1', () => {
            somePromise.then(() => {
              doSomeOperation();
              expect(someThing).toEqual(true);
            })
          });
      `,
      errors: [
        {
          column: 13,
          endColumn: 15,
          message: expectedMsg,
        },
      ],
    },
    {
      code: `
         test('invalid return', () => {
           const promise = something().then(value => {
             const foo = "foo";
             return expect(value).toBe('red');
           });
         });
      `,
      errors: [
        {
          column: 18,
          endColumn: 14,
          message: expectedMsg,
        },
      ],
    },
  ],

  valid: [
    `
      it('it1', () => new Promise((done) => {
        test()
          .then(() => {
            expect(someThing).toEqual(true);
            done();
          });
      }));
    `,
    `
      it('it1', () => {
        return somePromise.then(() => {
          expect(someThing).toEqual(true);
        });
      });
    `,

    `
      it('it1', function() {
        return somePromise.catch(function() {
          expect(someThing).toEqual(true);
        });
      });
    `,

    `
      it('it1', function() {
        return somePromise.then(function() {
          doSomeThingButNotExpect();
        });
      });
    `,

    `
      it('it1', function() {
        return getSomeThing().getPromise().then(function() {
          expect(someThing).toEqual(true);
        });
      });
    `,

    `
      it('it1', function() {
        return Promise.resolve().then(function() {
          expect(someThing).toEqual(true);
        });
      });
    `,

    `
      it('it1', function () {
        return Promise.resolve().then(function () {
          /*fulfillment*/
          expect(someThing).toEqual(true);
        }, function () {
          /*rejection*/
          expect(someThing).toEqual(true);
        });
      });
    `,

    `
      it('it1', function () {
        return Promise.resolve().then(function () {
          /*fulfillment*/
        }, function () {
          /*rejection*/
          expect(someThing).toEqual(true);
        });
      });
    `,

    `
      it('it1', function () {
        return somePromise.then()
      });
    `,

    `
      it('it1', async () => {
        await Promise.resolve().then(function () {
          expect(someThing).toEqual(true)
        });
      });
    `,

    `
      it('it1', async () => {
        await somePromise.then(() => {
          expect(someThing).toEqual(true)
        });
      });
    `,

    `
      it('it1', async () => {
        await getSomeThing().getPromise().then(function () {
          expect(someThing).toEqual(true)
        });
      });
    `,

    `
      it('it1', () => {
        return somePromise.then(() => {
            expect(someThing).toEqual(true);
          })
          .then(() => {
            expect(someThing).toEqual(true);
          })
      });
    `,

    `
      it('it1', () => {
        return somePromise.then(() => {
            expect(someThing).toEqual(true);
          })
          .catch(() => {
            expect(someThing).toEqual(false);
          })
      });
    `,

    `
     test('later return', () => {
       const promise = something().then(value => {
         expect(value).toBe('red');
       });

       return promise;
     });
    `,

    `
     it('shorthand arrow', () =>
       something().then(value => {
         expect(() => {
           value();
         }).toThrow();
       }));
    `,

    `
      it('promise test', () => {
        const somePromise = getThatPromise();
        somePromise.then((data) => {
          expect(data).toEqual('foo');
        });
        expect(somePromise).toBeDefined();
        return somePromise;
      });
    `,

    `
      test('promise test', function () {
        let somePromise = getThatPromise();
        somePromise.then((data) => {
          expect(data).toEqual('foo');
        });
        expect(somePromise).toBeDefined();
        return somePromise;
      });
    `,

    `
      it('crawls for files based on patterns', () => {
        const promise = nodeCrawl({}).then(data => {
          expect(childProcess.spawn).lastCalledWith('find');
        });
        return promise;
      });
    `,

    `
      it('test function',
        () => {
          return Builder.getPromiseBuilder().get().build()
            .then((data) => {
              expect(data).toEqual('Hi');
            });
      });
    `,

    `
      notATestFunction('not a test function',
        () => {
          Builder.getPromiseBuilder().get().build()
            .then((data) => {
              expect(data).toEqual('Hi');
            });
      });
    `,

    `
      it("it1", () => somePromise.then(() => {
        expect(someThing).toEqual(true)
      }))
    `,

    ` it("it1", () => somePromise.then(() => expect(someThing).toEqual(true)))`,

    `
      it('promise test with done', (done) => {
        const promise = getPromise();
        promise.then(() => expect(someThing).toEqual(true));
      });
    `,

    `
      it('name of done param does not matter', (nameDoesNotMatter) => {
        const promise = getPromise();
        promise.then(() => expect(someThing).toEqual(true));
      });
    `,
  ],
});
