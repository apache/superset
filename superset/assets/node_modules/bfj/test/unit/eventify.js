'use strict'

const assert = require('chai').assert
const events = require('../../src/events')
const Promise = require('bluebird')
const spooks = require('spooks')

const modulePath = '../../src/eventify'

suite('eventify:', () => {
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
    let eventify

    setup(() => {
      eventify = require(modulePath)
    })

    test('eventify does not throw', () => {
      assert.doesNotThrow(() => {
        eventify()
      })
    })

    test('eventify returns EventEmitter', () => {
      assert.instanceOf(eventify(), require('events').EventEmitter)
    })

    test('EventEmitter is decorated with pause method', () => {
      assert.isFunction(eventify().pause)
      assert.lengthOf(eventify().pause, 0)
    })

    test('pause method returns continue function', () => {
      assert.isFunction(eventify().pause())
      assert.lengthOf(eventify().pause(), 0)
    })

    suite('undefined:', () => {
      setup(done => {
        const emitter = eventify(undefined)

        Object.keys(events).forEach(key => {
          emitter.on(events[key], spooks.fn({
            name: key,
            log: log
          }))
        })

        emitter.on(events.end, done)
      })

      test('end event occurred once', () => {
        assert.strictEqual(log.counts.end, 1)
      })

      test('end event was dispatched correctly', () => {
        assert.lengthOf(log.args.end[0], 1)
        assert.isUndefined(log.args.end[0][0])
      })

      test('array event did not occur', () => {
        assert.strictEqual(log.counts.array, 0)
      })

      test('object event did not occur', () => {
        assert.strictEqual(log.counts.object, 0)
      })

      test('property event did not occur', () => {
        assert.strictEqual(log.counts.property, 0)
      })

      test('string event did not occur', () => {
        assert.strictEqual(log.counts.string, 0)
      })

      test('number event did not occur', () => {
        assert.strictEqual(log.counts.number, 0)
      })

      test('literal event did not occur', () => {
        assert.strictEqual(log.counts.literal, 0)
      })

      test('endArray event did not occur', () => {
        assert.strictEqual(log.counts.endArray, 0)
      })

      test('endObject event did not occur', () => {
        assert.strictEqual(log.counts.endObject, 0)
      })

      test('error event did not occur', () => {
        assert.strictEqual(log.counts.error, 0)
      })

      test('dataError event did not occur', () => {
        assert.strictEqual(log.counts.dataError, 0)
      })

      test('endPrefix event did not occur', () => {
        assert.strictEqual(log.counts.endPrefix, 0)
      })
    })

    suite('NaN:', () => {
      setup(done => {
        const emitter = eventify(NaN)

        Object.keys(events).forEach(key => {
          emitter.on(events[key], spooks.fn({
            name: key,
            log: log
          }))
        })

        emitter.on(events.end, done)
      })

      test('end event occurred once', () => {
        assert.strictEqual(log.counts.end, 1)
      })

      test('end event was dispatched correctly', () => {
        assert.lengthOf(log.args.end[0], 1)
        assert.isUndefined(log.args.end[0][0])
      })

      test('array event did not occur', () => {
        assert.strictEqual(log.counts.array, 0)
      })

      test('object event did not occur', () => {
        assert.strictEqual(log.counts.object, 0)
      })

      test('property event did not occur', () => {
        assert.strictEqual(log.counts.property, 0)
      })

      test('string event did not occur', () => {
        assert.strictEqual(log.counts.string, 0)
      })

      test('number event did not occur', () => {
        assert.strictEqual(log.counts.number, 0)
      })

      test('literal event did not occur', () => {
        assert.strictEqual(log.counts.literal, 0)
      })

      test('endArray event did not occur', () => {
        assert.strictEqual(log.counts.endArray, 0)
      })

      test('endObject event did not occur', () => {
        assert.strictEqual(log.counts.endObject, 0)
      })

      test('error event did not occur', () => {
        assert.strictEqual(log.counts.error, 0)
      })

      test('dataError event did not occur', () => {
        assert.strictEqual(log.counts.dataError, 0)
      })

      test('endPrefix event did not occur', () => {
        assert.strictEqual(log.counts.endPrefix, 0)
      })
    })

    suite('Infinity:', () => {
      setup(done => {
        const emitter = eventify(Infinity)

        Object.keys(events).forEach(key => {
          emitter.on(events[key], spooks.fn({
            name: key,
            log: log
          }))
        })

        emitter.on(events.end, done)
      })

      test('end event occurred once', () => {
        assert.strictEqual(log.counts.end, 1)
      })

      test('end event was dispatched correctly', () => {
        assert.lengthOf(log.args.end[0], 1)
        assert.isUndefined(log.args.end[0][0])
      })

      test('array event did not occur', () => {
        assert.strictEqual(log.counts.array, 0)
      })

      test('object event did not occur', () => {
        assert.strictEqual(log.counts.object, 0)
      })

      test('property event did not occur', () => {
        assert.strictEqual(log.counts.property, 0)
      })

      test('string event did not occur', () => {
        assert.strictEqual(log.counts.string, 0)
      })

      test('number event did not occur', () => {
        assert.strictEqual(log.counts.number, 0)
      })

      test('literal event did not occur', () => {
        assert.strictEqual(log.counts.literal, 0)
      })

      test('endArray event did not occur', () => {
        assert.strictEqual(log.counts.endArray, 0)
      })

      test('endObject event did not occur', () => {
        assert.strictEqual(log.counts.endObject, 0)
      })

      test('error event did not occur', () => {
        assert.strictEqual(log.counts.error, 0)
      })

      test('dataError event did not occur', () => {
        assert.strictEqual(log.counts.dataError, 0)
      })

      test('endPrefix event did not occur', () => {
        assert.strictEqual(log.counts.endPrefix, 0)
      })
    })

    suite('Number.NEGATIVE_INFINITY:', () => {
      setup(done => {
        const emitter = eventify(Number.NEGATIVE_INFINITY)

        Object.keys(events).forEach(key => {
          emitter.on(events[key], spooks.fn({
            name: key,
            log: log
          }))
        })

        emitter.on(events.end, done)
      })

      test('end event occurred once', () => {
        assert.strictEqual(log.counts.end, 1)
      })

      test('end event was dispatched correctly', () => {
        assert.lengthOf(log.args.end[0], 1)
        assert.isUndefined(log.args.end[0][0])
      })

      test('array event did not occur', () => {
        assert.strictEqual(log.counts.array, 0)
      })

      test('object event did not occur', () => {
        assert.strictEqual(log.counts.object, 0)
      })

      test('property event did not occur', () => {
        assert.strictEqual(log.counts.property, 0)
      })

      test('string event did not occur', () => {
        assert.strictEqual(log.counts.string, 0)
      })

      test('number event did not occur', () => {
        assert.strictEqual(log.counts.number, 0)
      })

      test('literal event did not occur', () => {
        assert.strictEqual(log.counts.literal, 0)
      })

      test('endArray event did not occur', () => {
        assert.strictEqual(log.counts.endArray, 0)
      })

      test('endObject event did not occur', () => {
        assert.strictEqual(log.counts.endObject, 0)
      })

      test('error event did not occur', () => {
        assert.strictEqual(log.counts.error, 0)
      })

      test('dataError event did not occur', () => {
        assert.strictEqual(log.counts.dataError, 0)
      })

      test('endPrefix event did not occur', () => {
        assert.strictEqual(log.counts.endPrefix, 0)
      })
    })

    suite('function:', () => {
      setup(done => {
        const emitter = eventify(() => {})

        Object.keys(events).forEach(key => {
          emitter.on(events[key], spooks.fn({
            name: key,
            log: log
          }))
        })

        emitter.on(events.end, done)
      })

      test('end event occurred once', () => {
        assert.strictEqual(log.counts.end, 1)
      })

      test('array event did not occur', () => {
        assert.strictEqual(log.counts.array, 0)
      })

      test('object event did not occur', () => {
        assert.strictEqual(log.counts.object, 0)
      })

      test('property event did not occur', () => {
        assert.strictEqual(log.counts.property, 0)
      })

      test('string event did not occur', () => {
        assert.strictEqual(log.counts.string, 0)
      })

      test('number event did not occur', () => {
        assert.strictEqual(log.counts.number, 0)
      })

      test('literal event did not occur', () => {
        assert.strictEqual(log.counts.literal, 0)
      })

      test('endArray event did not occur', () => {
        assert.strictEqual(log.counts.endArray, 0)
      })

      test('endObject event did not occur', () => {
        assert.strictEqual(log.counts.endObject, 0)
      })

      test('error event did not occur', () => {
        assert.strictEqual(log.counts.error, 0)
      })

      test('dataError event did not occur', () => {
        assert.strictEqual(log.counts.dataError, 0)
      })

      test('endPrefix event did not occur', () => {
        assert.strictEqual(log.counts.endPrefix, 0)
      })
    })

    suite('symbol:', () => {
      setup(done => {
        const emitter = eventify(Symbol('foo'))

        Object.keys(events).forEach(key => {
          emitter.on(events[key], spooks.fn({
            name: key,
            log: log
          }))
        })

        emitter.on(events.end, done)
      })

      test('end event occurred once', () => {
        assert.strictEqual(log.counts.end, 1)
      })

      test('array event did not occur', () => {
        assert.strictEqual(log.counts.array, 0)
      })

      test('object event did not occur', () => {
        assert.strictEqual(log.counts.object, 0)
      })

      test('property event did not occur', () => {
        assert.strictEqual(log.counts.property, 0)
      })

      test('string event did not occur', () => {
        assert.strictEqual(log.counts.string, 0)
      })

      test('number event did not occur', () => {
        assert.strictEqual(log.counts.number, 0)
      })

      test('literal event did not occur', () => {
        assert.strictEqual(log.counts.literal, 0)
      })

      test('endArray event did not occur', () => {
        assert.strictEqual(log.counts.endArray, 0)
      })

      test('endObject event did not occur', () => {
        assert.strictEqual(log.counts.endObject, 0)
      })

      test('error event did not occur', () => {
        assert.strictEqual(log.counts.error, 0)
      })

      test('dataError event did not occur', () => {
        assert.strictEqual(log.counts.dataError, 0)
      })

      test('endPrefix event did not occur', () => {
        assert.strictEqual(log.counts.endPrefix, 0)
      })
    })

    suite('empty array:', () => {
      setup(done => {
        const emitter = eventify([])

        Object.keys(events).forEach(key => {
          emitter.on(events[key], spooks.fn({
            name: key,
            log: log
          }))
        })

        emitter.on(events.end, done)
      })

      test('array event occurred once', () => {
        assert.strictEqual(log.counts.array, 1)
      })

      test('array event was dispatched correctly', () => {
        assert.lengthOf(log.args.array[0], 1)
        assert.isUndefined(log.args.array[0][0])
      })

      test('endArray event occurred once', () => {
        assert.strictEqual(log.counts.endArray, 1)
      })

      test('endArray event was dispatched correctly', () => {
        assert.lengthOf(log.args.endArray[0], 1)
        assert.isUndefined(log.args.endArray[0][0])
      })

      test('end event occurred once', () => {
        assert.strictEqual(log.counts.end, 1)
      })

      test('object event did not occur', () => {
        assert.strictEqual(log.counts.object, 0)
      })

      test('property event did not occur', () => {
        assert.strictEqual(log.counts.property, 0)
      })

      test('string event did not occur', () => {
        assert.strictEqual(log.counts.string, 0)
      })

      test('number event did not occur', () => {
        assert.strictEqual(log.counts.number, 0)
      })

      test('literal event did not occur', () => {
        assert.strictEqual(log.counts.literal, 0)
      })

      test('endObject event did not occur', () => {
        assert.strictEqual(log.counts.endObject, 0)
      })

      test('error event did not occur', () => {
        assert.strictEqual(log.counts.error, 0)
      })

      test('dataError event did not occur', () => {
        assert.strictEqual(log.counts.dataError, 0)
      })

      test('endPrefix event did not occur', () => {
        assert.strictEqual(log.counts.endPrefix, 0)
      })
    })

    suite('empty object:', () => {
      setup(done => {
        const emitter = eventify({})

        Object.keys(events).forEach(key => {
          emitter.on(events[key], spooks.fn({
            name: key,
            log: log
          }))
        })

        emitter.on(events.end, done)
      })

      test('object event occurred once', () => {
        assert.strictEqual(log.counts.object, 1)
      })

      test('object event was dispatched correctly', () => {
        assert.lengthOf(log.args.object[0], 1)
        assert.isUndefined(log.args.object[0][0])
      })

      test('endObject event occurred once', () => {
        assert.strictEqual(log.counts.endObject, 1)
      })

      test('endObject event was dispatched correctly', () => {
        assert.lengthOf(log.args.endObject[0], 1)
        assert.isUndefined(log.args.endObject[0][0])
      })

      test('end event occurred once', () => {
        assert.strictEqual(log.counts.end, 1)
      })

      test('array event did not occur', () => {
        assert.strictEqual(log.counts.array, 0)
      })

      test('property event did not occur', () => {
        assert.strictEqual(log.counts.property, 0)
      })

      test('string event did not occur', () => {
        assert.strictEqual(log.counts.string, 0)
      })

      test('number event did not occur', () => {
        assert.strictEqual(log.counts.number, 0)
      })

      test('literal event did not occur', () => {
        assert.strictEqual(log.counts.literal, 0)
      })

      test('endArray event did not occur', () => {
        assert.strictEqual(log.counts.endArray, 0)
      })

      test('error event did not occur', () => {
        assert.strictEqual(log.counts.error, 0)
      })

      test('dataError event did not occur', () => {
        assert.strictEqual(log.counts.dataError, 0)
      })

      test('endPrefix event did not occur', () => {
        assert.strictEqual(log.counts.endPrefix, 0)
      })
    })

    suite('string:', () => {
      setup(done => {
        const emitter = eventify('foo')

        Object.keys(events).forEach(key => {
          emitter.on(events[key], spooks.fn({
            name: key,
            log: log
          }))
        })

        emitter.on(events.end, done)
      })

      test('string event occurred once', () => {
        assert.strictEqual(log.counts.string, 1)
      })

      test('string event was dispatched correctly', () => {
        assert.lengthOf(log.args.string[0], 1)
        assert.strictEqual(log.args.string[0][0], 'foo')
      })

      test('end event occurred once', () => {
        assert.strictEqual(log.counts.end, 1)
      })

      test('array event did not occur', () => {
        assert.strictEqual(log.counts.array, 0)
      })

      test('object event did not occur', () => {
        assert.strictEqual(log.counts.object, 0)
      })

      test('property event did not occur', () => {
        assert.strictEqual(log.counts.property, 0)
      })

      test('number event did not occur', () => {
        assert.strictEqual(log.counts.number, 0)
      })

      test('literal event did not occur', () => {
        assert.strictEqual(log.counts.literal, 0)
      })

      test('endArray event did not occur', () => {
        assert.strictEqual(log.counts.endArray, 0)
      })

      test('endObject event did not occur', () => {
        assert.strictEqual(log.counts.endObject, 0)
      })

      test('error event did not occur', () => {
        assert.strictEqual(log.counts.error, 0)
      })

      test('dataError event did not occur', () => {
        assert.strictEqual(log.counts.dataError, 0)
      })

      test('endPrefix event did not occur', () => {
        assert.strictEqual(log.counts.endPrefix, 0)
      })
    })

    suite('string with special characters:', () => {
      setup(done => {
        const emitter = eventify('foo\nbar\t"baz"')

        Object.keys(events).forEach(key => {
          emitter.on(events[key], spooks.fn({
            name: key,
            log: log
          }))
        })

        emitter.on(events.end, done)
      })

      test('string event occurred once', () => {
        assert.strictEqual(log.counts.string, 1)
      })

      test('string event was dispatched correctly', () => {
        assert.lengthOf(log.args.string[0], 1)
        assert.strictEqual(log.args.string[0][0], 'foo\\nbar\\t\\"baz\\"')
      })

      test('error event did not occur', () => {
        assert.strictEqual(log.counts.error, 0)
      })

      test('dataError event did not occur', () => {
        assert.strictEqual(log.counts.dataError, 0)
      })
    })

    suite('number:', () => {
      setup(done => {
        const emitter = eventify(42)

        Object.keys(events).forEach(key => {
          emitter.on(events[key], spooks.fn({
            name: key,
            log: log
          }))
        })

        emitter.on(events.end, done)
      })

      test('number event occurred once', () => {
        assert.strictEqual(log.counts.number, 1)
      })

      test('number event was dispatched correctly', () => {
        assert.lengthOf(log.args.number[0], 1)
        assert.strictEqual(log.args.number[0][0], 42)
      })

      test('end event occurred once', () => {
        assert.strictEqual(log.counts.end, 1)
      })

      test('array event did not occur', () => {
        assert.strictEqual(log.counts.array, 0)
      })

      test('object event did not occur', () => {
        assert.strictEqual(log.counts.object, 0)
      })

      test('property event did not occur', () => {
        assert.strictEqual(log.counts.property, 0)
      })

      test('string event did not occur', () => {
        assert.strictEqual(log.counts.string, 0)
      })

      test('literal event did not occur', () => {
        assert.strictEqual(log.counts.literal, 0)
      })

      test('endArray event did not occur', () => {
        assert.strictEqual(log.counts.endArray, 0)
      })

      test('endObject event did not occur', () => {
        assert.strictEqual(log.counts.endObject, 0)
      })

      test('error event did not occur', () => {
        assert.strictEqual(log.counts.error, 0)
      })

      test('dataError event did not occur', () => {
        assert.strictEqual(log.counts.dataError, 0)
      })

      test('endPrefix event did not occur', () => {
        assert.strictEqual(log.counts.endPrefix, 0)
      })
    })

    suite('false:', () => {
      setup(done => {
        const emitter = eventify(false)

        Object.keys(events).forEach(key => {
          emitter.on(events[key], spooks.fn({
            name: key,
            log: log
          }))
        })

        emitter.on(events.end, done)
      })

      test('literal event occurred once', () => {
        assert.strictEqual(log.counts.literal, 1)
      })

      test('literal event was dispatched correctly', () => {
        assert.lengthOf(log.args.literal[0], 1)
        assert.isFalse(log.args.literal[0][0])
      })

      test('end event occurred once', () => {
        assert.strictEqual(log.counts.end, 1)
      })

      test('array event did not occur', () => {
        assert.strictEqual(log.counts.array, 0)
      })

      test('object event did not occur', () => {
        assert.strictEqual(log.counts.object, 0)
      })

      test('property event did not occur', () => {
        assert.strictEqual(log.counts.property, 0)
      })

      test('string event did not occur', () => {
        assert.strictEqual(log.counts.string, 0)
      })

      test('number event did not occur', () => {
        assert.strictEqual(log.counts.number, 0)
      })

      test('endArray event did not occur', () => {
        assert.strictEqual(log.counts.endArray, 0)
      })

      test('endObject event did not occur', () => {
        assert.strictEqual(log.counts.endObject, 0)
      })

      test('error event did not occur', () => {
        assert.strictEqual(log.counts.error, 0)
      })

      test('dataError event did not occur', () => {
        assert.strictEqual(log.counts.dataError, 0)
      })

      test('endPrefix event did not occur', () => {
        assert.strictEqual(log.counts.endPrefix, 0)
      })
    })

    suite('true:', () => {
      setup(done => {
        const emitter = eventify(true)

        Object.keys(events).forEach(key => {
          emitter.on(events[key], spooks.fn({
            name: key,
            log: log
          }))
        })

        emitter.on(events.end, done)
      })

      test('literal event occurred once', () => {
        assert.strictEqual(log.counts.literal, 1)
      })

      test('literal event was dispatched correctly', () => {
        assert.isTrue(log.args.literal[0][0])
      })

      test('end event occurred once', () => {
        assert.strictEqual(log.counts.end, 1)
      })

      test('error event did not occur', () => {
        assert.strictEqual(log.counts.error, 0)
      })

      test('dataError event did not occur', () => {
        assert.strictEqual(log.counts.dataError, 0)
      })
    })

    suite('null:', () => {
      setup(done => {
        const emitter = eventify(null)

        Object.keys(events).forEach(key => {
          emitter.on(events[key], spooks.fn({
            name: key,
            log: log
          }))
        })

        emitter.on(events.end, done)
      })

      test('literal event occurred once', () => {
        assert.strictEqual(log.counts.literal, 1)
      })

      test('literal event was dispatched correctly', () => {
        assert.isNull(log.args.literal[0][0])
      })

      test('end event occurred once', () => {
        assert.strictEqual(log.counts.end, 1)
      })

      test('error event did not occur', () => {
        assert.strictEqual(log.counts.error, 0)
      })

      test('dataError event did not occur', () => {
        assert.strictEqual(log.counts.dataError, 0)
      })
    })

    suite('array with items:', () => {
      setup(done => {
        const emitter = eventify([
          undefined,
          NaN,
          Number.POSITIVE_INFINITY,
          Number.NEGATIVE_INFINITY,
          'foo',
          () => {},
          'bar',
          Symbol('baz')
        ])

        Object.keys(events).forEach(key => {
          emitter.on(events[key], spooks.fn({
            name: key,
            log: log
          }))
        })

        emitter.on(events.end, done)
      })

      test('array event occurred once', () => {
        assert.strictEqual(log.counts.array, 1)
      })

      test('literal event occurred six times', () => {
        assert.strictEqual(log.counts.literal, 6)
      })

      test('literal event was dispatched correctly first time', () => {
        assert.isNull(log.args.literal[0][0])
      })

      test('literal event was dispatched correctly second time', () => {
        assert.isNull(log.args.literal[1][0])
      })

      test('literal event was dispatched correctly third time', () => {
        assert.isNull(log.args.literal[2][0])
      })

      test('literal event was dispatched correctly fourth time', () => {
        assert.isNull(log.args.literal[3][0])
      })

      test('literal event was dispatched correctly fifth time', () => {
        assert.isNull(log.args.literal[4][0])
      })

      test('literal event was dispatched correctly sixth time', () => {
        assert.isNull(log.args.literal[5][0])
      })

      test('string event occurred twice', () => {
        assert.strictEqual(log.counts.string, 2)
      })

      test('string event was dispatched correctly first time', () => {
        assert.strictEqual(log.args.string[0][0], 'foo')
      })

      test('string event was dispatched correctly second time', () => {
        assert.strictEqual(log.args.string[1][0], 'bar')
      })

      test('endArray event occurred once', () => {
        assert.strictEqual(log.counts.endArray, 1)
      })

      test('end event occurred once', () => {
        assert.strictEqual(log.counts.end, 1)
      })

      test('error event did not occur', () => {
        assert.strictEqual(log.counts.error, 0)
      })

      test('dataError event did not occur', () => {
        assert.strictEqual(log.counts.dataError, 0)
      })
    })

    suite('object with properties:', () => {
      setup(done => {
        const emitter = eventify({ foo: 42,
          bar: undefined,
          baz: 3.14159265359,
          qux: Symbol('qux')
        })

        Object.keys(events).forEach(key => {
          emitter.on(events[key], spooks.fn({
            name: key,
            log: log
          }))
        })

        emitter.on(events.end, done)
      })

      test('object event occurred once', () => {
        assert.strictEqual(log.counts.object, 1)
      })

      test('property event occurred twice', () => {
        assert.strictEqual(log.counts.property, 2)
      })

      test('property event was dispatched correctly first time', () => {
        assert.strictEqual(log.args.property[0][0], 'foo')
      })

      test('property event was dispatched correctly second time', () => {
        assert.strictEqual(log.args.property[1][0], 'baz')
      })

      test('number event occurred twice', () => {
        assert.strictEqual(log.counts.number, 2)
      })

      test('number event was dispatched correctly first time', () => {
        assert.strictEqual(log.args.number[0][0], 42)
      })

      test('number event was dispatched correctly second time', () => {
        assert.strictEqual(log.args.number[1][0], 3.14159265359)
      })

      test('endObject event occurred once', () => {
        assert.strictEqual(log.counts.endObject, 1)
      })

      test('end event occurred once', () => {
        assert.strictEqual(log.counts.end, 1)
      })

      test('literal event did not occur', () => {
        assert.strictEqual(log.counts.literal, 0)
      })

      test('error event did not occur', () => {
        assert.strictEqual(log.counts.error, 0)
      })

      test('dataError event did not occur', () => {
        assert.strictEqual(log.counts.dataError, 0)
      })
    })

    suite('nested array:', () => {
      setup(done => {
        const emitter = eventify([ 'foo', [ 'bar', [ 'baz', 'qux' ] ] ])

        Object.keys(events).forEach(key => {
          emitter.on(events[key], spooks.fn({
            name: key,
            log: log
          }))
        })

        emitter.on(events.end, done)
      })

      test('array event occurred three times', () => {
        assert.strictEqual(log.counts.array, 3)
      })

      test('string event occurred four times', () => {
        assert.strictEqual(log.counts.string, 4)
      })

      test('string event was dispatched correctly first time', () => {
        assert.strictEqual(log.args.string[0][0], 'foo')
      })

      test('string event was dispatched correctly second time', () => {
        assert.strictEqual(log.args.string[1][0], 'bar')
      })

      test('string event was dispatched correctly third time', () => {
        assert.strictEqual(log.args.string[2][0], 'baz')
      })

      test('string event was dispatched correctly fourth time', () => {
        assert.strictEqual(log.args.string[3][0], 'qux')
      })

      test('endArray event occurred three times', () => {
        assert.strictEqual(log.counts.endArray, 3)
      })

      test('end event occurred once', () => {
        assert.strictEqual(log.counts.end, 1)
      })

      test('error event did not occur', () => {
        assert.strictEqual(log.counts.error, 0)
      })

      test('dataError event did not occur', () => {
        assert.strictEqual(log.counts.dataError, 0)
      })
    })

    suite('nested object:', () => {
      setup(done => {
        const emitter = eventify({ foo: { bar: { baz: 1, qux: 2 }, wibble: 3 }, wobble: 4 })

        Object.keys(events).forEach(key => {
          emitter.on(events[key], spooks.fn({
            name: key,
            log: log
          }))
        })

        emitter.on(events.end, done)
      })

      test('object event occurred three times', () => {
        assert.strictEqual(log.counts.object, 3)
      })

      test('property event occurred six times', () => {
        assert.strictEqual(log.counts.property, 6)
      })

      test('property event was dispatched correctly first time', () => {
        assert.strictEqual(log.args.property[0][0], 'foo')
      })

      test('property event was dispatched correctly second time', () => {
        assert.strictEqual(log.args.property[1][0], 'bar')
      })

      test('property event was dispatched correctly third time', () => {
        assert.strictEqual(log.args.property[2][0], 'baz')
      })

      test('property event was dispatched correctly fourth time', () => {
        assert.strictEqual(log.args.property[3][0], 'qux')
      })

      test('property event was dispatched correctly fifth time', () => {
        assert.strictEqual(log.args.property[4][0], 'wibble')
      })

      test('property event was dispatched correctly sixth time', () => {
        assert.strictEqual(log.args.property[5][0], 'wobble')
      })

      test('number event occurred four times', () => {
        assert.strictEqual(log.counts.number, 4)
      })

      test('number event was dispatched correctly first time', () => {
        assert.strictEqual(log.args.number[0][0], 1)
      })

      test('number event was dispatched correctly second time', () => {
        assert.strictEqual(log.args.number[1][0], 2)
      })

      test('number event was dispatched correctly third time', () => {
        assert.strictEqual(log.args.number[2][0], 3)
      })

      test('number event was dispatched correctly fourth time', () => {
        assert.strictEqual(log.args.number[3][0], 4)
      })

      test('endObject event occurred three times', () => {
        assert.strictEqual(log.counts.endObject, 3)
      })

      test('end event occurred once', () => {
        assert.strictEqual(log.counts.end, 1)
      })

      test('error event did not occur', () => {
        assert.strictEqual(log.counts.error, 0)
      })

      test('dataError event did not occur', () => {
        assert.strictEqual(log.counts.dataError, 0)
      })
    })

    suite('promise:', () => {
      setup(done => {
        let resolve

        const emitter = eventify(new Promise(res => resolve = res), { poll: 4 })

        Object.keys(events).forEach(key => {
          emitter.on(events[key], spooks.fn({
            name: key,
            log: log
          }))
        })

        emitter.on(events.end, done)

        setTimeout(resolve.bind(null, 'foo'), 20)
      })

      test('string event occurred once', () => {
        assert.strictEqual(log.counts.string, 1)
      })

      test('string event was dispatched correctly', () => {
        assert.lengthOf(log.args.string[0], 1)
        assert.strictEqual(log.args.string[0][0], 'foo')
      })

      test('end event occurred once', () => {
        assert.strictEqual(log.counts.end, 1)
      })

      test('array event did not occur', () => {
        assert.strictEqual(log.counts.array, 0)
      })

      test('object event did not occur', () => {
        assert.strictEqual(log.counts.object, 0)
      })

      test('property event did not occur', () => {
        assert.strictEqual(log.counts.property, 0)
      })

      test('number event did not occur', () => {
        assert.strictEqual(log.counts.number, 0)
      })

      test('literal event did not occur', () => {
        assert.strictEqual(log.counts.literal, 0)
      })

      test('endArray event did not occur', () => {
        assert.strictEqual(log.counts.endArray, 0)
      })

      test('endObject event did not occur', () => {
        assert.strictEqual(log.counts.endObject, 0)
      })

      test('error event did not occur', () => {
        assert.strictEqual(log.counts.error, 0)
      })

      test('dataError event did not occur', () => {
        assert.strictEqual(log.counts.dataError, 0)
      })

      test('endPrefix event did not occur', () => {
        assert.strictEqual(log.counts.endPrefix, 0)
      })
    })

    suite('ignore promise:', () => {
      setup(done => {
        let resolve

        const emitter = eventify(new Promise(res => resolve = res), { poll: 4, promises: 'ignore' })

        Object.keys(events).forEach(key => {
          emitter.on(events[key], spooks.fn({
            name: key,
            log: log
          }))
        })

        emitter.on(events.end, done)

        setTimeout(resolve.bind(null, 'foo'), 20)
      })

      test('end event occurred once', () => {
        assert.strictEqual(log.counts.end, 1)
      })

      test('array event did not occur', () => {
        assert.strictEqual(log.counts.array, 0)
      })

      test('object event did not occur', () => {
        assert.strictEqual(log.counts.object, 0)
      })

      test('property event did not occur', () => {
        assert.strictEqual(log.counts.property, 0)
      })

      test('string event did not occur', () => {
        assert.strictEqual(log.counts.string, 0)
      })

      test('number event did not occur', () => {
        assert.strictEqual(log.counts.number, 0)
      })

      test('literal event did not occur', () => {
        assert.strictEqual(log.counts.literal, 0)
      })

      test('endArray event did not occur', () => {
        assert.strictEqual(log.counts.endArray, 0)
      })

      test('endObject event did not occur', () => {
        assert.strictEqual(log.counts.endObject, 0)
      })

      test('error event did not occur', () => {
        assert.strictEqual(log.counts.error, 0)
      })

      test('dataError event did not occur', () => {
        assert.strictEqual(log.counts.dataError, 0)
      })

      test('endPrefix event did not occur', () => {
        assert.strictEqual(log.counts.endPrefix, 0)
      })
    })

    suite('buffer:', () => {
      setup(done => {
        let resolve

        const emitter = eventify(new Buffer('foo bar baz qux'))

        Object.keys(events).forEach(key => {
          emitter.on(events[key], spooks.fn({
            name: key,
            log: log
          }))
        })

        emitter.on(events.end, done)
      })

      test('string event occurred once', () => {
        assert.strictEqual(log.counts.string, 1)
      })

      test('string event was dispatched correctly', () => {
        assert.lengthOf(log.args.string[0], 1)
        assert.strictEqual(log.args.string[0][0], 'foo bar baz qux')
      })

      test('end event occurred once', () => {
        assert.strictEqual(log.counts.end, 1)
      })

      test('array event did not occur', () => {
        assert.strictEqual(log.counts.array, 0)
      })

      test('object event did not occur', () => {
        assert.strictEqual(log.counts.object, 0)
      })

      test('property event did not occur', () => {
        assert.strictEqual(log.counts.property, 0)
      })

      test('number event did not occur', () => {
        assert.strictEqual(log.counts.number, 0)
      })

      test('literal event did not occur', () => {
        assert.strictEqual(log.counts.literal, 0)
      })

      test('endArray event did not occur', () => {
        assert.strictEqual(log.counts.endArray, 0)
      })

      test('endObject event did not occur', () => {
        assert.strictEqual(log.counts.endObject, 0)
      })

      test('error event did not occur', () => {
        assert.strictEqual(log.counts.error, 0)
      })

      test('dataError event did not occur', () => {
        assert.strictEqual(log.counts.dataError, 0)
      })

      test('endPrefix event did not occur', () => {
        assert.strictEqual(log.counts.endPrefix, 0)
      })
    })

    suite('ignore buffer:', () => {
      setup(done => {
        let resolve

        const emitter = eventify(new Buffer('foo bar baz qux'), { buffers: 'ignore' })

        Object.keys(events).forEach(key => {
          emitter.on(events[key], spooks.fn({
            name: key,
            log: log
          }))
        })

        emitter.on(events.end, done)
      })

      test('end event occurred once', () => {
        assert.strictEqual(log.counts.end, 1)
      })

      test('array event did not occur', () => {
        assert.strictEqual(log.counts.array, 0)
      })

      test('object event did not occur', () => {
        assert.strictEqual(log.counts.object, 0)
      })

      test('property event did not occur', () => {
        assert.strictEqual(log.counts.property, 0)
      })

      test('string event did not occur', () => {
        assert.strictEqual(log.counts.string, 0)
      })

      test('number event did not occur', () => {
        assert.strictEqual(log.counts.number, 0)
      })

      test('literal event did not occur', () => {
        assert.strictEqual(log.counts.literal, 0)
      })

      test('endArray event did not occur', () => {
        assert.strictEqual(log.counts.endArray, 0)
      })

      test('endObject event did not occur', () => {
        assert.strictEqual(log.counts.endObject, 0)
      })

      test('error event did not occur', () => {
        assert.strictEqual(log.counts.error, 0)
      })

      test('dataError event did not occur', () => {
        assert.strictEqual(log.counts.dataError, 0)
      })

      test('endPrefix event did not occur', () => {
        assert.strictEqual(log.counts.endPrefix, 0)
      })
    })

    suite('date:', () => {
      setup(done => {
        let resolve

        const emitter = eventify(new Date('1977-06-10T10:30:00.000Z'))

        Object.keys(events).forEach(key => {
          emitter.on(events[key], spooks.fn({
            name: key,
            log: log
          }))
        })

        emitter.on(events.end, done)
      })

      test('string event occurred once', () => {
        assert.strictEqual(log.counts.string, 1)
      })

      test('string event was dispatched correctly', () => {
        assert.lengthOf(log.args.string[0], 1)
        assert.strictEqual(log.args.string[0][0], '1977-06-10T10:30:00.000Z')
      })

      test('end event occurred once', () => {
        assert.strictEqual(log.counts.end, 1)
      })

      test('array event did not occur', () => {
        assert.strictEqual(log.counts.array, 0)
      })

      test('object event did not occur', () => {
        assert.strictEqual(log.counts.object, 0)
      })

      test('property event did not occur', () => {
        assert.strictEqual(log.counts.property, 0)
      })

      test('number event did not occur', () => {
        assert.strictEqual(log.counts.number, 0)
      })

      test('literal event did not occur', () => {
        assert.strictEqual(log.counts.literal, 0)
      })

      test('endArray event did not occur', () => {
        assert.strictEqual(log.counts.endArray, 0)
      })

      test('endObject event did not occur', () => {
        assert.strictEqual(log.counts.endObject, 0)
      })

      test('error event did not occur', () => {
        assert.strictEqual(log.counts.error, 0)
      })

      test('dataError event did not occur', () => {
        assert.strictEqual(log.counts.dataError, 0)
      })

      test('endPrefix event did not occur', () => {
        assert.strictEqual(log.counts.endPrefix, 0)
      })
    })

    suite('object with toJSON method:', () => {
      setup(done => {
        let resolve

        const emitter = eventify({ toJSON () { return 'foo' } })

        Object.keys(events).forEach(key => {
          emitter.on(events[key], spooks.fn({
            name: key,
            log: log
          }))
        })

        emitter.on(events.end, done)
      })

      test('string event occurred once', () => {
        assert.strictEqual(log.counts.string, 1)
      })

      test('string event was dispatched correctly', () => {
        assert.lengthOf(log.args.string[0], 1)
        assert.strictEqual(log.args.string[0][0], 'foo')
      })

      test('end event occurred once', () => {
        assert.strictEqual(log.counts.end, 1)
      })

      test('array event did not occur', () => {
        assert.strictEqual(log.counts.array, 0)
      })

      test('object event did not occur', () => {
        assert.strictEqual(log.counts.object, 0)
      })

      test('property event did not occur', () => {
        assert.strictEqual(log.counts.property, 0)
      })

      test('number event did not occur', () => {
        assert.strictEqual(log.counts.number, 0)
      })

      test('literal event did not occur', () => {
        assert.strictEqual(log.counts.literal, 0)
      })

      test('endArray event did not occur', () => {
        assert.strictEqual(log.counts.endArray, 0)
      })

      test('endObject event did not occur', () => {
        assert.strictEqual(log.counts.endObject, 0)
      })

      test('error event did not occur', () => {
        assert.strictEqual(log.counts.error, 0)
      })

      test('dataError event did not occur', () => {
        assert.strictEqual(log.counts.dataError, 0)
      })

      test('endPrefix event did not occur', () => {
        assert.strictEqual(log.counts.endPrefix, 0)
      })
    })

    suite('map:', () => {
      setup(done => {
        let resolve

        const emitter = eventify(new Map([['foo','bar'],['baz','qux']]))

        Object.keys(events).forEach(key => {
          emitter.on(events[key], spooks.fn({
            name: key,
            log: log
          }))
        })

        emitter.on(events.end, done)
      })

      test('object event occurred once', () => {
        assert.strictEqual(log.counts.object, 1)
      })

      test('property event occurred twice', () => {
        assert.strictEqual(log.counts.property, 2)
      })

      test('property event was dispatched correctly first time', () => {
        assert.strictEqual(log.args.property[0][0], 'foo')
      })

      test('property event was dispatched correctly second time', () => {
        assert.strictEqual(log.args.property[1][0], 'baz')
      })

      test('string event occurred twice', () => {
        assert.strictEqual(log.counts.string, 2)
      })

      test('string event was dispatched correctly first time', () => {
        assert.strictEqual(log.args.string[0][0], 'bar')
      })

      test('string event was dispatched correctly second time', () => {
        assert.strictEqual(log.args.string[1][0], 'qux')
      })

      test('endObject event occurred once', () => {
        assert.strictEqual(log.counts.endObject, 1)
      })

      test('end event occurred once', () => {
        assert.strictEqual(log.counts.end, 1)
      })

      test('array event did not occur', () => {
        assert.strictEqual(log.counts.array, 0)
      })

      test('number event did not occur', () => {
        assert.strictEqual(log.counts.number, 0)
      })

      test('literal event did not occur', () => {
        assert.strictEqual(log.counts.literal, 0)
      })

      test('endArray event did not occur', () => {
        assert.strictEqual(log.counts.endArray, 0)
      })

      test('error event did not occur', () => {
        assert.strictEqual(log.counts.error, 0)
      })

      test('dataError event did not occur', () => {
        assert.strictEqual(log.counts.dataError, 0)
      })

      test('endPrefix event did not occur', () => {
        assert.strictEqual(log.counts.endPrefix, 0)
      })
    })

    suite('ignore map:', () => {
      setup(done => {
        let resolve

        const emitter = eventify(new Map([['foo','bar'],['baz','qux']]), { maps: 'ignore' })

        Object.keys(events).forEach(key => {
          emitter.on(events[key], spooks.fn({
            name: key,
            log: log
          }))
        })

        emitter.on(events.end, done)
      })

      test('end event occurred once', () => {
        assert.strictEqual(log.counts.end, 1)
      })

      test('array event did not occur', () => {
        assert.strictEqual(log.counts.array, 0)
      })

      test('object event did not occur', () => {
        assert.strictEqual(log.counts.object, 0)
      })

      test('property event did not occur', () => {
        assert.strictEqual(log.counts.property, 0)
      })

      test('string event did not occur', () => {
        assert.strictEqual(log.counts.string, 0)
      })

      test('number event did not occur', () => {
        assert.strictEqual(log.counts.number, 0)
      })

      test('literal event did not occur', () => {
        assert.strictEqual(log.counts.literal, 0)
      })

      test('endArray event did not occur', () => {
        assert.strictEqual(log.counts.endArray, 0)
      })

      test('endObject event did not occur', () => {
        assert.strictEqual(log.counts.endObject, 0)
      })

      test('error event did not occur', () => {
        assert.strictEqual(log.counts.error, 0)
      })

      test('dataError event did not occur', () => {
        assert.strictEqual(log.counts.dataError, 0)
      })

      test('endPrefix event did not occur', () => {
        assert.strictEqual(log.counts.endPrefix, 0)
      })
    })

    suite('set:', () => {
      setup(done => {
        let resolve

        const emitter = eventify(new Set(['foo','bar']))

        Object.keys(events).forEach(key => {
          emitter.on(events[key], spooks.fn({
            name: key,
            log: log
          }))
        })

        emitter.on(events.end, done)
      })

      test('array event occurred once', () => {
        assert.strictEqual(log.counts.array, 1)
      })

      test('string event occurred twice', () => {
        assert.strictEqual(log.counts.string, 2)
      })

      test('string event was dispatched correctly first time', () => {
        assert.strictEqual(log.args.string[0][0], 'foo')
      })

      test('string event was dispatched correctly second time', () => {
        assert.strictEqual(log.args.string[1][0], 'bar')
      })

      test('endArray event occurred once', () => {
        assert.strictEqual(log.counts.endArray, 1)
      })

      test('end event occurred once', () => {
        assert.strictEqual(log.counts.end, 1)
      })

      test('object event did not occur', () => {
        assert.strictEqual(log.counts.object, 0)
      })

      test('property event did not occur', () => {
        assert.strictEqual(log.counts.number, 0)
      })

      test('number event did not occur', () => {
        assert.strictEqual(log.counts.number, 0)
      })

      test('literal event did not occur', () => {
        assert.strictEqual(log.counts.literal, 0)
      })

      test('endObject event did not occur', () => {
        assert.strictEqual(log.counts.endObject, 0)
      })

      test('error event did not occur', () => {
        assert.strictEqual(log.counts.error, 0)
      })

      test('dataError event did not occur', () => {
        assert.strictEqual(log.counts.dataError, 0)
      })

      test('endPrefix event did not occur', () => {
        assert.strictEqual(log.counts.endPrefix, 0)
      })
    })

    suite('ignore set:', () => {
      setup(done => {
        let resolve

        const emitter = eventify(new Set(['foo','bar']), { iterables: 'ignore' })

        Object.keys(events).forEach(key => {
          emitter.on(events[key], spooks.fn({
            name: key,
            log: log
          }))
        })

        emitter.on(events.end, done)
      })

      test('end event occurred once', () => {
        assert.strictEqual(log.counts.end, 1)
      })

      test('array event did not occur', () => {
        assert.strictEqual(log.counts.array, 0)
      })

      test('object event did not occur', () => {
        assert.strictEqual(log.counts.object, 0)
      })

      test('property event did not occur', () => {
        assert.strictEqual(log.counts.property, 0)
      })

      test('string event did not occur', () => {
        assert.strictEqual(log.counts.string, 0)
      })

      test('number event did not occur', () => {
        assert.strictEqual(log.counts.number, 0)
      })

      test('literal event did not occur', () => {
        assert.strictEqual(log.counts.literal, 0)
      })

      test('endArray event did not occur', () => {
        assert.strictEqual(log.counts.endArray, 0)
      })

      test('endObject event did not occur', () => {
        assert.strictEqual(log.counts.endObject, 0)
      })

      test('error event did not occur', () => {
        assert.strictEqual(log.counts.error, 0)
      })

      test('dataError event did not occur', () => {
        assert.strictEqual(log.counts.dataError, 0)
      })

      test('endPrefix event did not occur', () => {
        assert.strictEqual(log.counts.endPrefix, 0)
      })
    })

    suite('promise resolved to a map:', () => {
      setup(done => {
        let resolve

        const emitter = eventify(new Promise(res => resolve = res), { poll: 4 })

        Object.keys(events).forEach(key => {
          emitter.on(events[key], spooks.fn({
            name: key,
            log: log
          }))
        })

        emitter.on(events.end, done)

        setImmediate(resolve.bind(null, new Map([['foo','bar'],['baz','qux']])))
      })

      test('object event occurred once', () => {
        assert.strictEqual(log.counts.object, 1)
      })

      test('property event occurred twice', () => {
        assert.strictEqual(log.counts.property, 2)
      })

      test('property event was dispatched correctly first time', () => {
        assert.strictEqual(log.args.property[0][0], 'foo')
      })

      test('property event was dispatched correctly second time', () => {
        assert.strictEqual(log.args.property[1][0], 'baz')
      })

      test('string event occurred twice', () => {
        assert.strictEqual(log.counts.string, 2)
      })

      test('string event was dispatched correctly first time', () => {
        assert.strictEqual(log.args.string[0][0], 'bar')
      })

      test('string event was dispatched correctly second time', () => {
        assert.strictEqual(log.args.string[1][0], 'qux')
      })

      test('endObject event occurred once', () => {
        assert.strictEqual(log.counts.endObject, 1)
      })

      test('end event occurred once', () => {
        assert.strictEqual(log.counts.end, 1)
      })

      test('array event did not occur', () => {
        assert.strictEqual(log.counts.array, 0)
      })

      test('number event did not occur', () => {
        assert.strictEqual(log.counts.number, 0)
      })

      test('literal event did not occur', () => {
        assert.strictEqual(log.counts.literal, 0)
      })

      test('endArray event did not occur', () => {
        assert.strictEqual(log.counts.endArray, 0)
      })

      test('error event did not occur', () => {
        assert.strictEqual(log.counts.error, 0)
      })

      test('dataError event did not occur', () => {
        assert.strictEqual(log.counts.dataError, 0)
      })

      test('endPrefix event did not occur', () => {
        assert.strictEqual(log.counts.endPrefix, 0)
      })
    })

    suite('array circular reference:', () => {
      setup(done => {
        const array = [ 'foo' ]
        array[1] = array
        const emitter = eventify(array)

        Object.keys(events).forEach(key => {
          emitter.on(events[key], spooks.fn({
            name: key,
            log: log
          }))
        })

        emitter.on(events.end, done)
      })

      test('array event occurred twice', () => {
        assert.strictEqual(log.counts.array, 2)
      })

      test('string event occurred once', () => {
        assert.strictEqual(log.counts.string, 1)
      })

      test('string event was dispatched correctly', () => {
        assert.strictEqual(log.args.string[0][0], 'foo')
      })

      test('endArray event occurred twice', () => {
        assert.strictEqual(log.counts.endArray, 2)
      })

      test('end event occurred once', () => {
        assert.strictEqual(log.counts.end, 1)
      })

      test('dataError event occurred once', () => {
        assert.strictEqual(log.counts.dataError, 1)
      })

      test('dataError event was dispatched correctly', () => {
        assert.lengthOf(log.args.dataError[0], 1)
        assert.instanceOf(log.args.dataError[0][0], Error)
        assert.strictEqual(log.args.dataError[0][0].message, 'Circular reference.')
      })

      test('error event did not occur', () => {
        assert.strictEqual(log.counts.error, 0)
      })
    })

    suite('object circular reference:', () => {
      setup(done => {
        const object = { foo: 'bar' }
        object.self = object
        const emitter = eventify(object)

        Object.keys(events).forEach(key => {
          emitter.on(events[key], spooks.fn({
            name: key,
            log: log
          }))
        })

        emitter.on(events.end, done)
      })

      test('object event occurred twice', () => {
        assert.strictEqual(log.counts.object, 2)
      })

      test('property event occurred twice', () => {
        assert.strictEqual(log.counts.property, 2)
      })

      test('property event was dispatched correctly first time', () => {
        assert.strictEqual(log.args.property[0][0], 'foo')
      })

      test('property event was dispatched correctly second time', () => {
        assert.strictEqual(log.args.property[1][0], 'self')
      })

      test('endObject event occurred twice', () => {
        assert.strictEqual(log.counts.endObject, 2)
      })

      test('end event occurred once', () => {
        assert.strictEqual(log.counts.end, 1)
      })

      test('dataError event occurred once', () => {
        assert.strictEqual(log.counts.dataError, 1)
      })

      test('dataError event was dispatched correctly', () => {
        assert.strictEqual(log.args.dataError[0][0].message, 'Circular reference.')
      })

      test('error event did not occur', () => {
        assert.strictEqual(log.counts.error, 0)
      })
    })

    suite('array circular reference with ignore set:', () => {
      setup(done => {
        const array = [ 'foo' ]
        array[1] = array
        const emitter = eventify(array, { circular: 'ignore' })

        Object.keys(events).forEach(key => {
          emitter.on(events[key], spooks.fn({
            name: key,
            log: log
          }))
        })

        emitter.on(events.end, done)
      })

      test('array event occurred twice', () => {
        assert.strictEqual(log.counts.array, 2)
      })

      test('string event occurred once', () => {
        assert.strictEqual(log.counts.string, 1)
      })

      test('endArray event occurred twice', () => {
        assert.strictEqual(log.counts.endArray, 2)
      })

      test('end event occurred once', () => {
        assert.strictEqual(log.counts.end, 1)
      })

      test('error event did not occur', () => {
        assert.strictEqual(log.counts.error, 0)
      })

      test('dataError event did not occur', () => {
        assert.strictEqual(log.counts.dataError, 0)
      })
    })

    suite('object circular reference with ignore set:', () => {
      setup(done => {
        const object = { foo: 'bar' }
        object.self = object
        const emitter = eventify(object, { circular: 'ignore' })

        Object.keys(events).forEach(key => {
          emitter.on(events[key], spooks.fn({
            name: key,
            log: log
          }))
        })

        emitter.on(events.end, done)
      })

      test('object event occurred twice', () => {
        assert.strictEqual(log.counts.object, 2)
      })

      test('property event occurred twice', () => {
        assert.strictEqual(log.counts.property, 2)
      })

      test('endObject event occurred twice', () => {
        assert.strictEqual(log.counts.endObject, 2)
      })

      test('end event occurred once', () => {
        assert.strictEqual(log.counts.end, 1)
      })

      test('error event did not occur', () => {
        assert.strictEqual(log.counts.error, 0)
      })

      test('dataError event did not occur', () => {
        assert.strictEqual(log.counts.dataError, 0)
      })
    })

    suite('parallel array reference:', () => {
      setup(done => {
        const array = [ 'foo' ]
        const emitter = eventify([ array, array ])

        Object.keys(events).forEach(key => {
          emitter.on(events[key], spooks.fn({
            name: key,
            log: log
          }))
        })

        emitter.on(events.end, done)
      })

      test('array event occurred three times', () => {
        assert.strictEqual(log.counts.array, 3)
      })

      test('string event occurred twice', () => {
        assert.strictEqual(log.counts.string, 2)
      })

      test('endArray event occurred three times', () => {
        assert.strictEqual(log.counts.endArray, 3)
      })

      test('end event occurred once', () => {
        assert.strictEqual(log.counts.end, 1)
      })

      test('error event did not occur', () => {
        assert.strictEqual(log.counts.error, 0)
      })

      test('dataError event did not occur', () => {
        assert.strictEqual(log.counts.dataError, 0)
      })
    })

    suite('parallel object reference:', () => {
      setup(done => {
        const object = { foo: 'bar' }
        const emitter = eventify({ baz: object, qux: object })

        Object.keys(events).forEach(key => {
          emitter.on(events[key], spooks.fn({
            name: key,
            log: log
          }))
        })

        emitter.on(events.end, done)
      })

      test('object event occurred three times', () => {
        assert.strictEqual(log.counts.object, 3)
      })

      test('property event occurred four times', () => {
        assert.strictEqual(log.counts.property, 4)
      })

      test('endObject event occurred three times', () => {
        assert.strictEqual(log.counts.endObject, 3)
      })

      test('end event occurred once', () => {
        assert.strictEqual(log.counts.end, 1)
      })

      test('error event did not occur', () => {
        assert.strictEqual(log.counts.error, 0)
      })

      test('dataError event did not occur', () => {
        assert.strictEqual(log.counts.dataError, 0)
      })
    })

    suite('throw errors from event handlers:', () => {
      setup(done => {
        const emitter = eventify([null,false,true,0,"",{"foo":"bar"}])

        Object.keys(events).forEach(key => {
          const event = events[key]
          emitter.on(event, spooks.fn({
            name: key,
            log: log
          }))
          if (event !== events.end) {
            emitter.on(event, () => { throw 0 })
          }
        })

        emitter.on(events.end, done)
      })

      test('end event occurred once', () => {
        assert.strictEqual(log.counts.end, 1)
      })

      test('array event occured once', () => {
        assert.strictEqual(log.counts.array, 1)
      })

      test('literal event occured three times', () => {
        assert.strictEqual(log.counts.literal, 3)
      })

      test('number event occured once', () => {
        assert.strictEqual(log.counts.number, 1)
      })

      test('string event occured twice', () => {
        assert.strictEqual(log.counts.string, 2)
      })

      test('object event occured once', () => {
        assert.strictEqual(log.counts.object, 1)
      })

      test('property event occured once', () => {
        assert.strictEqual(log.counts.property, 1)
      })

      test('endObject event occured once', () => {
        assert.strictEqual(log.counts.endObject, 1)
      })

      test('endArray event occured once', () => {
        assert.strictEqual(log.counts.endArray, 1)
      })

      test('error event occured eleven times', () => {
        assert.strictEqual(log.counts.error, 11)
      })

      test('dataError event did not occur', () => {
        assert.strictEqual(log.counts.dataError, 0)
      })
    })
  })
})
