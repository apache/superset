'use strict'

const assert = require('chai').assert
const proxyquire = require('proxyquire')
const spooks = require('spooks')
const Promise = require('bluebird')

const modulePath = '../../src/unpipe'

suite('unpipe:', () => {
  test('require does not throw', () => {
    assert.doesNotThrow(() => {
      require(modulePath)
    })
  })

  test('require returns function', () => {
    assert.isFunction(require(modulePath))
  })

  suite('require:', () => {
    let log, results, unpipe

    setup(() => {
      log = {}
      results = {
        parse: [ Promise.resolve() ]
      }
      unpipe = proxyquire(modulePath, {
        './parse': spooks.fn({
          name: 'parse',
          log: log,
          results: results.parse
        })
      })
    })

    test('unpipe expects two arguments', () => {
      assert.lengthOf(unpipe, 2)
    })

    test('unpipe does not throw', () => {
      assert.doesNotThrow(() => {
        unpipe(() => {})
      })
    })

    test('unpipe throws if callback is not provided', () => {
      assert.throws(() => {
        unpipe()
      })
    })

    test('parse was not called', () => {
      assert.strictEqual(log.counts.parse, 0)
    })

    suite('unpipe success:', () => {
      let result, error, options

      setup(done => {
        results.parse[0] = Promise.resolve('foo')
        options = { foo: 'bar', ndjson: true }
        unpipe((err, res) => {
          error = err
          result = res
          done()
        }, options)
      })

      test('parse was called once', () => {
        assert.strictEqual(log.counts.parse, 1)
      })

      test('parse was called correctly', () => {
        assert.isUndefined(log.these.parse[0])
        assert.lengthOf(log.args.parse[0], 2)
        assert.isObject(log.args.parse[0][0])
        assert.isTrue(log.args.parse[0][0].readable)
        assert.isTrue(log.args.parse[0][0].writable)
        assert.isFunction(log.args.parse[0][0].pipe)
        assert.isFunction(log.args.parse[0][0].read)
        assert.isFunction(log.args.parse[0][0]._read)
        assert.isFunction(log.args.parse[0][0].write)
        assert.isFunction(log.args.parse[0][0]._write)
        assert.notStrictEqual(log.args.parse[0][1], options)
        assert.deepEqual(log.args.parse[0][1], { foo: 'bar', ndjson: false })
      })

      test('parse result was returned', () => {
        assert.strictEqual(result, 'foo')
      })

      test('did not fail', () => {
        assert.isNull(error)
      })
    })

    suite('unpipe error:', () => {
      let result, error, options

      setup(done => {
        results.parse[0] = Promise.reject('bar')
        options = {}
        unpipe((err, res) => {
          error = err
          result = res
          done()
        }, options)
      })

      test('parse was called once', () => {
        assert.strictEqual(log.counts.parse, 1)
      })

      test('parse result was not returned', () => {
        assert.isUndefined(result)
      })

      test('failed', () => {
        assert.strictEqual(error, 'bar')
      })
    })
  })
})
