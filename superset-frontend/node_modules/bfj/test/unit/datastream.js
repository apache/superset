'use strict'

const assert = require('chai').assert
const spooks = require('spooks')

const modulePath = '../../src/datastream'

suite('datastream:', () => {
  let log

  setup(() => {
    log = {}
  })

  test('require does not throw', () => {
    assert.doesNotThrow(() => {
      require(modulePath)
    })
  })

  test('require returns function', () => {
    assert.isFunction(require(modulePath))
  })

  suite('require:', () => {
    let Stream

    setup(() => {
      Stream = require(modulePath)
    })

    test('Stream expects two arguments', () => {
      assert.lengthOf(Stream, 2)
    })

    test('calling Stream with function argument doesNotThrow', () => {
      assert.doesNotThrow(() => {
        Stream(() => {})
      })
    })

    test('calling Stream with object argument throws', () => {
      assert.throws(() => {
        Stream({ read: () => {} })
      })
    })

    test('calling Stream with new returns Stream instance', () => {
      assert.instanceOf(new Stream(() => {}), Stream)
    })

    test('calling Stream with new returns Readable instance', () => {
      assert.instanceOf(new Stream(() => {}), require('stream').Readable)
    })

    test('calling Stream without new returns Stream instance', () => {
      assert.instanceOf(Stream(() => {}), Stream)
    })

    suite('instantiate:', () => {
      let datastream

      setup(() => {
        datastream = new Stream(spooks.fn({ name: 'read', log: log }))
      })

      test('datastream has _read method', () => {
        assert.isFunction(datastream._read)
      })

      test('_read expects no arguments', () => {
        assert.lengthOf(datastream._read, 0)
      })

      test('read was not called', () => {
        assert.strictEqual(log.counts.read, 0)
      })

      suite('datastream._read:', () => {
        setup(() => {
          datastream._read()
        })

        test('read was called once', () => {
          assert.strictEqual(log.counts.read, 1)
          assert.isUndefined(log.these.read[0])
        })

        test('read was called correctly', () => {
          assert.lengthOf(log.args.read[0], 0)
        })
      })
    })
  })
})
