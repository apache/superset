'use strict'

const assert = require('chai').assert
const modulePath = '../../src/error'

suite('error:', () => {
  let log

  setup(() => {
    log = {}
  })

  test('require does not throw', () => {
    assert.doesNotThrow(() => {
      require(modulePath)
    })
  })

  test('require returns object', () => {
    assert.isObject(require(modulePath))
  })

  suite('require:', () => {
    let error

    setup(() => {
      error = require(modulePath)
    })

    test('error has create method', () => {
      assert.isFunction(error.create)
    })

    test('error has no other methods', () => {
      assert.lengthOf(Object.keys(error), 1)
    })

    test('create expects four arguments', () => {
      assert.lengthOf(error.create, 4)
    })

    test('create does not throw', () => {
      assert.doesNotThrow(() => {
        error.create()
      })
    })

    test('create returns Error', () => {
      assert.instanceOf(error.create(), Error)
    })

    suite('create:', () => {
      let created

      setup(() => {
        created = error.create('foo', 'bar', 'baz', 'qux')
      })

      test('created has correct actual property', () => {
        assert.strictEqual(created.actual, 'foo')
      })

      test('created has correct expected property', () => {
        assert.strictEqual(created.expected, 'bar')
      })

      test('created has correct lineNumber property', () => {
        assert.strictEqual(created.lineNumber, 'baz')
      })

      test('created has correct columnNumber property', () => {
        assert.strictEqual(created.columnNumber, 'qux')
      })

      test('created has correct message property', () => {
        assert.strictEqual(created.message, 'JSON error: encountered `foo` at line baz, column qux where `bar` was expected.')
      })
    })
  })
})
