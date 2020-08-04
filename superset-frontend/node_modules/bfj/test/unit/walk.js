'use strict'

const assert = require('chai').assert
const spooks = require('spooks')
const Readable = require('stream').Readable
const events = require('../../src/events')

const modulePath = '../../src/walk'

suite('walk:', () => {
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
    let walk

    setup(() => {
      walk = require(modulePath)
    })

    test('walk throws without readable stream', () => {
      assert.throws(() => {
        walk({ on: () => {} })
      })
    })

    test('walk does not throw with readable stream', () => {
      assert.doesNotThrow(() => {
        walk(new Readable())
      })
    })

    test('walk returns emitter', () => {
      assert.instanceOf(walk(new Readable()), require('events').EventEmitter)
    })

    test('EventEmitter is decorated with pause method', () => {
      assert.isFunction(walk(new Readable()).pause)
      assert.lengthOf(walk(new Readable()).pause, 0)
    })

    test('pause method returns continue function', () => {
      assert.isFunction(walk(new Readable()).pause())
      assert.lengthOf(walk(new Readable()).pause(), 0)
    })

    suite('empty json:', () => {
      let stream, emitter

      setup(done => {
        stream = new Readable()
        stream._read = () => {}

        emitter = walk(stream)

        stream.push('')
        stream.push(null)

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
        assert.lengthOf(log.args.end[0], 0)
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

      test('endLine event did not occur', () => {
        assert.strictEqual(log.counts.endLine, 0)
      })

      test('endPrefix event did not occur', () => {
        assert.strictEqual(log.counts.endPrefix, 0)
      })
    })

    suite('empty array:', () => {
      let stream, emitter

      setup(done => {
        stream = new Readable()
        stream._read = () => {}

        emitter = walk(stream)

        stream.push('[]')
        stream.push(null)

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
        assert.lengthOf(log.args.array[0], 0)
      })

      test('endArray event occurred once', () => {
        assert.strictEqual(log.counts.endArray, 1)
      })

      test('endArray event was dispatched correctly', () => {
        assert.lengthOf(log.args.endArray[0], 0)
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

      test('endLine event did not occur', () => {
        assert.strictEqual(log.counts.endLine, 0)
      })

      test('endPrefix event did not occur', () => {
        assert.strictEqual(log.counts.endPrefix, 0)
      })
    })

    suite('empty object:', () => {
      let stream, emitter

      setup(done => {
        stream = new Readable()
        stream._read = () => {}

        emitter = walk(stream)

        stream.push('{}')
        stream.push(null)

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
        assert.lengthOf(log.args.object[0], 0)
      })

      test('endObject event occurred once', () => {
        assert.strictEqual(log.counts.endObject, 1)
      })

      test('endObject event was dispatched correctly', () => {
        assert.lengthOf(log.args.endObject[0], 0)
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

      test('endLine event did not occur', () => {
        assert.strictEqual(log.counts.endLine, 0)
      })

      test('endPrefix event did not occur', () => {
        assert.strictEqual(log.counts.endPrefix, 0)
      })
    })

    suite('string:', () => {
      let stream, emitter

      setup(done => {
        stream = new Readable()
        stream._read = () => {}

        emitter = walk(stream)

        stream.push('"\\"the quick brown fox\r\n\\tjumps\\u00a0over the lazy\\u1680dog\\""')
        stream.push(null)

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
        assert.strictEqual(log.args.string[0][0], '"the quick brown fox\r\n\tjumps\u00a0over the lazy\u1680dog"')
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

      test('endLine event did not occur', () => {
        assert.strictEqual(log.counts.endLine, 0)
      })

      test('endPrefix event did not occur', () => {
        assert.strictEqual(log.counts.endPrefix, 0)
      })
    })

    suite('number:', () => {
      let stream, emitter

      setup(done => {
        stream = new Readable()
        stream._read = () => {}

        emitter = walk(stream)

        stream.push('-3.14159265359e+42')
        stream.push(null)

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
        assert.strictEqual(log.args.number[0][0], -3.14159265359e+42)
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

      test('endLine event did not occur', () => {
        assert.strictEqual(log.counts.endLine, 0)
      })

      test('endPrefix event did not occur', () => {
        assert.strictEqual(log.counts.endPrefix, 0)
      })
    })

    suite('literal false:', () => {
      let stream, emitter

      setup(done => {
        stream = new Readable()
        stream._read = () => {}

        emitter = walk(stream)

        stream.push('false')
        stream.push(null)

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
        assert.strictEqual(log.args.literal[0][0], false)
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

      test('endLine event did not occur', () => {
        assert.strictEqual(log.counts.endLine, 0)
      })

      test('endPrefix event did not occur', () => {
        assert.strictEqual(log.counts.endPrefix, 0)
      })
    })

    suite('literal null:', () => {
      let stream, emitter

      setup(done => {
        stream = new Readable()
        stream._read = () => {}

        emitter = walk(stream)

        stream.push('null')
        stream.push(null)

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
        assert.strictEqual(log.args.literal[0][0], null)
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

      test('endLine event did not occur', () => {
        assert.strictEqual(log.counts.endLine, 0)
      })

      test('endPrefix event did not occur', () => {
        assert.strictEqual(log.counts.endPrefix, 0)
      })
    })

    suite('literal true:', () => {
      let stream, emitter

      setup(done => {
        stream = new Readable()
        stream._read = () => {}

        emitter = walk(stream)

        stream.push('true')
        stream.push(null)

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
        assert.strictEqual(log.args.literal[0][0], true)
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

      test('endLine event did not occur', () => {
        assert.strictEqual(log.counts.endLine, 0)
      })

      test('endPrefix event did not occur', () => {
        assert.strictEqual(log.counts.endPrefix, 0)
      })
    })

    suite('badly-closed array:', () => {
      let stream, emitter

      setup(done => {
        stream = new Readable()
        stream._read = () => {}

        emitter = walk(stream)

        stream.push('[}')
        stream.push(null)

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

      test('dataError event occurred twice', () => {
        assert.strictEqual(log.counts.dataError, 2)
      })

      test('dataError event was dispatched correctly first time', () => {
        assert.lengthOf(log.args.dataError[0], 1)
        assert.instanceOf(log.args.dataError[0][0], Error)
        assert.strictEqual(log.args.dataError[0][0].actual, '}')
        assert.strictEqual(log.args.dataError[0][0].expected, 'value')
        assert.strictEqual(log.args.dataError[0][0].lineNumber, 1)
        assert.strictEqual(log.args.dataError[0][0].columnNumber, 2)
      })

      test('dataError event was dispatched correctly second time', () => {
        assert.strictEqual(log.args.dataError[1][0].actual, 'EOF')
        assert.strictEqual(log.args.dataError[1][0].expected, ']')
        assert.strictEqual(log.args.dataError[1][0].lineNumber, 1)
        assert.strictEqual(log.args.dataError[1][0].columnNumber, 3)
      })

      test('end event occurred once', () => {
        assert.strictEqual(log.counts.end, 1)
      })

      test('object event did not occur', () => {
        assert.strictEqual(log.counts.object, 0)
      })

      test('endArray event did not occur', () => {
        assert.strictEqual(log.counts.endArray, 0)
      })

      test('endObject event did not occur', () => {
        assert.strictEqual(log.counts.endObject, 0)
      })
    })

    suite('badly-closed object:', () => {
      let stream, emitter

      setup(done => {
        stream = new Readable()
        stream._read = () => {}

        emitter = walk(stream)

        stream.push('{]')
        stream.push(null)

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

      test('dataError event occurred three times', () => {
        assert.strictEqual(log.counts.dataError, 3)
      })

      test('dataError event was dispatched correctly first time', () => {
        assert.strictEqual(log.args.dataError[0][0].actual, ']')
        assert.strictEqual(log.args.dataError[0][0].expected, '"')
        assert.strictEqual(log.args.dataError[0][0].lineNumber, 1)
        assert.strictEqual(log.args.dataError[0][0].columnNumber, 2)
      })

      test('dataError event was dispatched correctly second time', () => {
        assert.strictEqual(log.args.dataError[1][0].actual, 'EOF')
        assert.strictEqual(log.args.dataError[1][0].expected, '"')
        assert.strictEqual(log.args.dataError[1][0].lineNumber, 1)
        assert.strictEqual(log.args.dataError[1][0].columnNumber, 3)
      })

      test('dataError event was dispatched correctly third time', () => {
        assert.strictEqual(log.args.dataError[2][0].actual, 'EOF')
        assert.strictEqual(log.args.dataError[2][0].expected, '}')
        assert.strictEqual(log.args.dataError[2][0].lineNumber, 1)
        assert.strictEqual(log.args.dataError[2][0].columnNumber, 3)
      })

      test('end event occurred once', () => {
        assert.strictEqual(log.counts.end, 1)
      })

      test('array event did not occur', () => {
        assert.strictEqual(log.counts.array, 0)
      })

      test('endArray event did not occur', () => {
        assert.strictEqual(log.counts.endArray, 0)
      })

      test('endObject event did not occur', () => {
        assert.strictEqual(log.counts.endObject, 0)
      })
    })

    suite('string containing bad escape sequence:', () => {
      let stream, emitter

      setup(done => {
        stream = new Readable()
        stream._read = () => {}

        emitter = walk(stream)

        stream.push('"\\"the quick brown fox\r\n\\tjumps over the lazy\\xdog\\""')
        stream.push(null)

        Object.keys(events).forEach(key => {
          emitter.on(events[key], spooks.fn({
            name: key,
            log: log
          }))
        })

        emitter.on(events.end, done)
      })

      test('dataError event occurred once', () => {
        assert.strictEqual(log.counts.dataError, 1)
      })

      test('dataError event was dispatched correctly', () => {
        assert.strictEqual(log.args.dataError[0][0].actual, 'x')
        assert.strictEqual(log.args.dataError[0][0].expected, 'escape character')
        assert.strictEqual(log.args.dataError[0][0].lineNumber, 2)
        assert.strictEqual(log.args.dataError[0][0].columnNumber, 23)
      })

      test('string event occurred once', () => {
        assert.strictEqual(log.counts.string, 1)
      })

      test('string event was dispatched correctly', () => {
        assert.strictEqual(log.args.string[0][0], '"the quick brown fox\r\n\tjumps over the lazy\\xdog"')
      })

      test('end event occurred once', () => {
        assert.strictEqual(log.counts.end, 1)
      })
    })

    suite('string containing bad unicode escape sequence:', () => {
      let stream, emitter

      setup(done => {
        stream = new Readable()
        stream._read = () => {}

        emitter = walk(stream)

        stream.push('"\\u012g"')
        stream.push(null)

        Object.keys(events).forEach(key => {
          emitter.on(events[key], spooks.fn({
            name: key,
            log: log
          }))
        })

        emitter.on(events.end, done)
      })

      test('dataError event occurred once', () => {
        assert.strictEqual(log.counts.dataError, 1)
      })

      test('dataError event was dispatched correctly', () => {
        assert.strictEqual(log.args.dataError[0][0].actual, 'g')
        assert.strictEqual(log.args.dataError[0][0].expected, 'hex digit')
        assert.strictEqual(log.args.dataError[0][0].lineNumber, 1)
        assert.strictEqual(log.args.dataError[0][0].columnNumber, 7)
      })

      test('string event occurred once', () => {
        assert.strictEqual(log.counts.string, 1)
      })

      test('string event was dispatched correctly', () => {
        assert.strictEqual(log.args.string[0][0], '\\u012g')
      })

      test('end event occurred once', () => {
        assert.strictEqual(log.counts.end, 1)
      })
    })

    suite('unterminated string:', () => {
      let stream, emitter

      setup(done => {
        stream = new Readable()
        stream._read = () => {}

        emitter = walk(stream)

        stream.push('"foo')
        stream.push(null)

        Object.keys(events).forEach(key => {
          emitter.on(events[key], spooks.fn({
            name: key,
            log: log
          }))
        })

        emitter.on(events.end, done)
      })

      test('dataError event occurred once', () => {
        assert.strictEqual(log.counts.dataError, 1)
      })

      test('dataError event was dispatched correctly', () => {
        assert.strictEqual(log.args.dataError[0][0].actual, 'EOF')
        assert.strictEqual(log.args.dataError[0][0].expected, '"')
        assert.strictEqual(log.args.dataError[0][0].lineNumber, 1)
        assert.strictEqual(log.args.dataError[0][0].columnNumber, 5)
      })

      test('end event occurred once', () => {
        assert.strictEqual(log.counts.end, 1)
      })

      test('string event did not occur', () => {
        assert.strictEqual(log.counts.string, 0)
      })
    })

    suite('bad number:', () => {
      let stream, emitter

      setup(done => {
        stream = new Readable()
        stream._read = () => {}

        emitter = walk(stream)

        stream.push('1e')
        stream.push(null)

        Object.keys(events).forEach(key => {
          emitter.on(events[key], spooks.fn({
            name: key,
            log: log
          }))
        })

        emitter.on(events.end, done)
      })

      test('number event did not occur', () => {
        assert.strictEqual(log.counts.number, 0)
      })

      test('dataError event occurred once', () => {
        assert.strictEqual(log.counts.dataError, 1)
      })

      test('dataError event was dispatched correctly first time', () => {
        assert.strictEqual(log.args.dataError[0][0].actual, 'EOF')
        assert.strictEqual(log.args.dataError[0][0].expected, 'exponent')
        assert.strictEqual(log.args.dataError[0][0].lineNumber, 1)
        assert.strictEqual(log.args.dataError[0][0].columnNumber, 3)
      })

      test('end event occurred once', () => {
        assert.strictEqual(log.counts.end, 1)
      })

      test('literal event did not occur', () => {
        assert.strictEqual(log.counts.literal, 0)
      })
    })

    suite('alternative bad number:', () => {
      let stream, emitter

      setup(done => {
        stream = new Readable()
        stream._read = () => {}

        emitter = walk(stream)

        stream.push('42f')
        stream.push(null)

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
        assert.strictEqual(log.args.number[0][0], 42)
      })

      test('dataError event occurred twice', () => {
        assert.strictEqual(log.counts.dataError, 2)
      })

      test('dataError event was dispatched correctly first time', () => {
        assert.strictEqual(log.args.dataError[0][0].actual, 'f')
        assert.strictEqual(log.args.dataError[0][0].expected, 'EOF')
        assert.strictEqual(log.args.dataError[0][0].lineNumber, 1)
        assert.strictEqual(log.args.dataError[0][0].columnNumber, 3)
      })

      test('dataError event was dispatched correctly second time', () => {
        assert.strictEqual(log.args.dataError[1][0].actual, 'EOF')
        assert.strictEqual(log.args.dataError[1][0].expected, 'a')
        assert.strictEqual(log.args.dataError[1][0].lineNumber, 1)
        assert.strictEqual(log.args.dataError[1][0].columnNumber, 4)
      })

      test('end event occurred once', () => {
        assert.strictEqual(log.counts.end, 1)
      })

      test('literal event did not occur', () => {
        assert.strictEqual(log.counts.literal, 0)
      })
    })

    suite('bad literal false:', () => {
      let stream, emitter

      setup(done => {
        stream = new Readable()
        stream._read = () => {}

        emitter = walk(stream)

        stream.push('falsd')
        stream.push(null)

        Object.keys(events).forEach(key => {
          emitter.on(events[key], spooks.fn({
            name: key,
            log: log
          }))
        })

        emitter.on(events.end, done)
      })

      test('dataError event occurred once', () => {
        assert.strictEqual(log.counts.dataError, 1)
      })

      test('dataError event was dispatched correctly', () => {
        assert.strictEqual(log.args.dataError[0][0].actual, 'd')
        assert.strictEqual(log.args.dataError[0][0].expected, 'e')
        assert.strictEqual(log.args.dataError[0][0].lineNumber, 1)
        assert.strictEqual(log.args.dataError[0][0].columnNumber, 5)
      })

      test('end event occurred once', () => {
        assert.strictEqual(log.counts.end, 1)
      })

      test('literal event did not occur', () => {
        assert.strictEqual(log.counts.literal, 0)
      })
    })

    suite('bad literal null:', () => {
      let stream, emitter

      setup(done => {
        stream = new Readable()
        stream._read = () => {}

        emitter = walk(stream)

        stream.push('nul')
        stream.push(null)

        Object.keys(events).forEach(key => {
          emitter.on(events[key], spooks.fn({
            name: key,
            log: log
          }))
        })

        emitter.on(events.end, done)
      })

      test('dataError event occurred once', () => {
        assert.strictEqual(log.counts.dataError, 1)
      })

      test('dataError event was dispatched correctly', () => {
        assert.strictEqual(log.args.dataError[0][0].actual, 'EOF')
        assert.strictEqual(log.args.dataError[0][0].expected, 'l')
        assert.strictEqual(log.args.dataError[0][0].lineNumber, 1)
        assert.strictEqual(log.args.dataError[0][0].columnNumber, 4)
      })

      test('end event occurred once', () => {
        assert.strictEqual(log.counts.end, 1)
      })

      test('literal event did not occur', () => {
        assert.strictEqual(log.counts.literal, 0)
      })
    })

    suite('bad literal true:', () => {
      let stream, emitter

      setup(done => {
        stream = new Readable()
        stream._read = () => {}

        emitter = walk(stream)

        stream.push('tRue')
        stream.push(null)

        Object.keys(events).forEach(key => {
          emitter.on(events[key], spooks.fn({
            name: key,
            log: log
          }))
        })

        emitter.on(events.end, done)
      })

      test('dataError event occurred four times', () => {
        assert.strictEqual(log.counts.dataError, 4)
      })

      test('dataError event was dispatched correctly first time', () => {
        assert.strictEqual(log.args.dataError[0][0].actual, 'R')
        assert.strictEqual(log.args.dataError[0][0].expected, 'r')
        assert.strictEqual(log.args.dataError[0][0].lineNumber, 1)
        assert.strictEqual(log.args.dataError[0][0].columnNumber, 2)
      })

      test('dataError event was dispatched correctly second time', () => {
        assert.strictEqual(log.args.dataError[1][0].actual, 'u')
        assert.strictEqual(log.args.dataError[1][0].expected, 'EOF')
        assert.strictEqual(log.args.dataError[1][0].lineNumber, 1)
        assert.strictEqual(log.args.dataError[1][0].columnNumber, 3)
      })

      test('dataError event was dispatched correctly third time', () => {
        assert.strictEqual(log.args.dataError[2][0].actual, 'u')
        assert.strictEqual(log.args.dataError[2][0].expected, 'value')
        assert.strictEqual(log.args.dataError[2][0].lineNumber, 1)
        assert.strictEqual(log.args.dataError[2][0].columnNumber, 3)
      })

      test('dataError event was dispatched correctly fourth time', () => {
        assert.strictEqual(log.args.dataError[3][0].actual, 'e')
        assert.strictEqual(log.args.dataError[3][0].expected, 'value')
        assert.strictEqual(log.args.dataError[3][0].lineNumber, 1)
        assert.strictEqual(log.args.dataError[3][0].columnNumber, 4)
      })

      test('end event occurred once', () => {
        assert.strictEqual(log.counts.end, 1)
      })

      test('literal event did not occur', () => {
        assert.strictEqual(log.counts.literal, 0)
      })
    })

    suite('array inside array:', () => {
      let stream, emitter

      setup(done => {
        stream = new Readable()
        stream._read = () => {}

        emitter = walk(stream)

        stream.push('[[]]')
        stream.push(null)

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

      test('endLine event did not occur', () => {
        assert.strictEqual(log.counts.endLine, 0)
      })
    })

    suite('two arrays inside array:', () => {
      let stream, emitter

      setup(done => {
        stream = new Readable()
        stream._read = () => {}

        emitter = walk(stream)

        stream.push('[[],[]]')
        stream.push(null)

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

    suite('two arrays inside array with whitespace:', () => {
      let stream, emitter

      setup(done => {
        stream = new Readable()
        stream._read = () => {}

        emitter = walk(stream)

        stream.push(' [ [] , [] ] ')
        stream.push(null)

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

    suite('two arrays inside array without comma:', () => {
      let stream, emitter

      setup(done => {
        stream = new Readable()
        stream._read = () => {}

        emitter = walk(stream)

        stream.push('[[][]]')
        stream.push(null)

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

      test('endArray event occurred three times', () => {
        assert.strictEqual(log.counts.endArray, 3)
      })

      test('dataError event occurred once', () => {
        assert.strictEqual(log.counts.dataError, 1)
      })

      test('dataError event was dispatched correctly', () => {
        assert.strictEqual(log.args.dataError[0][0].actual, '[')
        assert.strictEqual(log.args.dataError[0][0].expected, ',')
        assert.strictEqual(log.args.dataError[0][0].lineNumber, 1)
        assert.strictEqual(log.args.dataError[0][0].columnNumber, 4)
      })

      test('end event occurred once', () => {
        assert.strictEqual(log.counts.end, 1)
      })

      test('endObject event did not occur', () => {
        assert.strictEqual(log.counts.endObject, 0)
      })
    })

    suite('object inside array:', () => {
      let stream, emitter

      setup(done => {
        stream = new Readable()
        stream._read = () => {}

        emitter = walk(stream)

        stream.push('[{}]')
        stream.push(null)

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

      test('object event occurred once', () => {
        assert.strictEqual(log.counts.object, 1)
      })

      test('endObject event occurred once', () => {
        assert.strictEqual(log.counts.endObject, 1)
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

      test('endLine event did not occur', () => {
        assert.strictEqual(log.counts.endLine, 0)
      })
    })

    suite('two objects inside array:', () => {
      let stream, emitter

      setup(done => {
        stream = new Readable()
        stream._read = () => {}

        emitter = walk(stream)

        stream.push('[{},{}]')
        stream.push(null)

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

      test('object event occurred twice', () => {
        assert.strictEqual(log.counts.object, 2)
      })

      test('endObject event occurred twice', () => {
        assert.strictEqual(log.counts.endObject, 2)
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

    suite('two objects inside array with whitespace:', () => {
      let stream, emitter

      setup(done => {
        stream = new Readable()
        stream._read = () => {}

        emitter = walk(stream)

        stream.push('\t[\t{}\t,\r{}\n]\r\n')
        stream.push(null)

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

      test('object event occurred twice', () => {
        assert.strictEqual(log.counts.object, 2)
      })

      test('endObject event occurred twice', () => {
        assert.strictEqual(log.counts.endObject, 2)
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

    suite('two objects inside array without comma:', () => {
      let stream, emitter

      setup(done => {
        stream = new Readable()
        stream._read = () => {}

        emitter = walk(stream)

        stream.push('[ {} {} ]')
        stream.push(null)

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

      test('object event occurred twice', () => {
        assert.strictEqual(log.counts.object, 2)
      })

      test('endObject event occurred twice', () => {
        assert.strictEqual(log.counts.endObject, 2)
      })

      test('dataError event occurred once', () => {
        assert.strictEqual(log.counts.dataError, 1)
      })

      test('dataError event was dispatched correctly', () => {
        assert.strictEqual(log.args.dataError[0][0].actual, '{')
        assert.strictEqual(log.args.dataError[0][0].expected, ',')
        assert.strictEqual(log.args.dataError[0][0].lineNumber, 1)
        assert.strictEqual(log.args.dataError[0][0].columnNumber, 6)
      })

      test('endArray event occurred once', () => {
        assert.strictEqual(log.counts.endArray, 1)
      })

      test('end event occurred once', () => {
        assert.strictEqual(log.counts.end, 1)
      })
    })

    suite('string inside array:', () => {
      let stream, emitter

      setup(done => {
        stream = new Readable()
        stream._read = () => {}

        emitter = walk(stream)

        stream.push('["foo"]')
        stream.push(null)

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

      test('string event occurred once', () => {
        assert.strictEqual(log.counts.string, 1)
      })

      test('string event was dispatched correctly', () => {
        assert.strictEqual(log.args.string[0][0], 'foo')
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

      test('error event did not occur', () => {
        assert.strictEqual(log.counts.error, 0)
      })

      test('dataError event did not occur', () => {
        assert.strictEqual(log.counts.dataError, 0)
      })

      test('endLine event did not occur', () => {
        assert.strictEqual(log.counts.endLine, 0)
      })
    })

    suite('two strings inside array:', () => {
      let stream, emitter

      setup(done => {
        stream = new Readable()
        stream._read = () => {}

        emitter = walk(stream)

        stream.push('["foo","bar"]')
        stream.push(null)

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

      test('error event did not occur', () => {
        assert.strictEqual(log.counts.error, 0)
      })

      test('dataError event did not occur', () => {
        assert.strictEqual(log.counts.dataError, 0)
      })
    })

    suite('two strings inside array with whitespace:', () => {
      let stream, emitter

      setup(done => {
        stream = new Readable()
        stream._read = () => {}

        emitter = walk(stream)

        stream.push('  [  "baz"  ,  "qux"  ]  ')
        stream.push(null)

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
        assert.strictEqual(log.args.string[0][0], 'baz')
      })

      test('string event was dispatched correctly second time', () => {
        assert.strictEqual(log.args.string[1][0], 'qux')
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

    suite('literal inside array:', () => {
      let stream, emitter

      setup(done => {
        stream = new Readable()
        stream._read = () => {}

        emitter = walk(stream)

        stream.push('[false]')
        stream.push(null)

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

      test('literal event occurred once', () => {
        assert.strictEqual(log.counts.literal, 1)
      })

      test('literal event was dispatched correctly', () => {
        assert.strictEqual(log.args.literal[0][0], false)
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

    suite('two literals inside array:', () => {
      let stream, emitter

      setup(done => {
        stream = new Readable()
        stream._read = () => {}

        emitter = walk(stream)

        stream.push('[true,null]')
        stream.push(null)

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

      test('literal event occurred twice', () => {
        assert.strictEqual(log.counts.literal, 2)
      })

      test('literal event was dispatched correctly first time', () => {
        assert.strictEqual(log.args.literal[0][0], true)
      })

      test('literal event was dispatched correctly second time', () => {
        assert.strictEqual(log.args.literal[1][0], null)
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

    suite('two literals inside array with whitespace:', () => {
      let stream, emitter

      setup(done => {
        stream = new Readable()
        stream._read = () => {}

        emitter = walk(stream)

        stream.push('[ null , false ]')
        stream.push(null)

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

      test('literal event occurred twice', () => {
        assert.strictEqual(log.counts.literal, 2)
      })

      test('literal event was dispatched correctly first time', () => {
        assert.strictEqual(log.args.literal[0][0], null)
      })

      test('literal event was dispatched correctly second time', () => {
        assert.strictEqual(log.args.literal[1][0], false)
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

    suite('number inside array:', () => {
      let stream, emitter

      setup(done => {
        stream = new Readable()
        stream._read = () => {}

        emitter = walk(stream)

        stream.push('[0]')
        stream.push(null)

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

      test('number event occurred once', () => {
        assert.strictEqual(log.counts.number, 1)
      })

      test('number event was dispatched correctly', () => {
        assert.strictEqual(log.args.number[0][0], 0)
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

    suite('two numbers inside array:', () => {
      let stream, emitter

      setup(done => {
        stream = new Readable()
        stream._read = () => {}

        emitter = walk(stream)

        stream.push('[1,2]')
        stream.push(null)

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

      test('number event occurred twice', () => {
        assert.strictEqual(log.counts.number, 2)
      })

      test('number event was dispatched correctly first time', () => {
        assert.strictEqual(log.args.number[0][0], 1)
      })

      test('number event was dispatched correctly second time', () => {
        assert.strictEqual(log.args.number[1][0], 2)
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

    suite('two numbers inside array with whitespace:', () => {
      let stream, emitter

      setup(done => {
        stream = new Readable()
        stream._read = () => {}

        emitter = walk(stream)

        stream.push('[ 1977 , -1977 ]')
        stream.push(null)

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

      test('number event occurred twice', () => {
        assert.strictEqual(log.counts.number, 2)
      })

      test('number event was dispatched correctly first time', () => {
        assert.strictEqual(log.args.number[0][0], 1977)
      })

      test('number event was dispatched correctly second time', () => {
        assert.strictEqual(log.args.number[1][0], -1977)
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

    suite('object inside object:', () => {
      let stream, emitter

      setup(done => {
        stream = new Readable()
        stream._read = () => {}

        emitter = walk(stream)

        stream.push('{"foo":{}}')
        stream.push(null)

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

      test('property event occurred once', () => {
        assert.strictEqual(log.counts.property, 1)
      })

      test('property event was dispatched correctly', () => {
        assert.lengthOf(log.args.property[0], 1)
        assert.strictEqual(log.args.property[0][0], 'foo')
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

    suite('array and object inside object:', () => {
      let stream, emitter

      setup(done => {
        stream = new Readable()
        stream._read = () => {}

        emitter = walk(stream)

        stream.push('{"wibble wobble":[],"jelly on the plate":{}}')
        stream.push(null)

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
        assert.strictEqual(log.args.property[0][0], 'wibble wobble')
      })

      test('property event was dispatched correctly second time', () => {
        assert.strictEqual(log.args.property[1][0], 'jelly on the plate')
      })

      test('array event occurred once', () => {
        assert.strictEqual(log.counts.array, 1)
      })

      test('endArray event occurred once', () => {
        assert.strictEqual(log.counts.endArray, 1)
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

    suite('string, literal and number inside object with whitespace:', () => {
      let stream, emitter

      setup(done => {
        stream = new Readable()
        stream._read = () => {}

        emitter = walk(stream)

        stream.push('   { "foo" : "bar" ,\t"baz"\t:\tnull\t,\r\n"qux"\r\n:\r\n3.14159265359\r\n} ')
        stream.push(null)

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

      test('property event occurred three times', () => {
        assert.strictEqual(log.counts.property, 3)
      })

      test('property event was dispatched correctly first time', () => {
        assert.strictEqual(log.args.property[0][0], 'foo')
      })

      test('property event was dispatched correctly second time', () => {
        assert.strictEqual(log.args.property[1][0], 'baz')
      })

      test('property event was dispatched correctly third time', () => {
        assert.strictEqual(log.args.property[2][0], 'qux')
      })

      test('string event occurred once', () => {
        assert.strictEqual(log.counts.string, 1)
      })

      test('string event was dispatched correctly', () => {
        assert.strictEqual(log.args.string[0][0], 'bar')
      })

      test('literal event occurred once', () => {
        assert.strictEqual(log.counts.literal, 1)
      })

      test('literal event was dispatched correctly', () => {
        assert.isNull(log.args.literal[0][0])
      })

      test('number event occurred once', () => {
        assert.strictEqual(log.counts.number, 1)
      })

      test('number event was dispatched correctly', () => {
        assert.strictEqual(log.args.number[0][0], 3.14159265359)
      })

      test('endObject event occurred once', () => {
        assert.strictEqual(log.counts.endObject, 1)
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

    suite('two objects inside object without comma:', () => {
      let stream, emitter

      setup(done => {
        stream = new Readable()
        stream._read = () => {}

        emitter = walk(stream)

        stream.push('{"foo":{}"bar":{}}')
        stream.push(null)

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

      test('property event occurred twice', () => {
        assert.strictEqual(log.counts.property, 2)
      })

      test('property event was dispatched correctly first time', () => {
        assert.strictEqual(log.args.property[0][0], 'foo')
      })

      test('property event was dispatched correctly second time', () => {
        assert.strictEqual(log.args.property[1][0], 'bar')
      })

      test('dataError event occurred once', () => {
        assert.strictEqual(log.counts.dataError, 1)
      })

      test('dataError event was dispatched correctly', () => {
        assert.strictEqual(log.args.dataError[0][0].actual, '"')
        assert.strictEqual(log.args.dataError[0][0].expected, ',')
        assert.strictEqual(log.args.dataError[0][0].lineNumber, 1)
        assert.strictEqual(log.args.dataError[0][0].columnNumber, 10)
      })

      test('endObject event occurred three times', () => {
        assert.strictEqual(log.counts.endObject, 3)
      })

      test('end event occurred once', () => {
        assert.strictEqual(log.counts.end, 1)
      })
    })

    suite('unquoted property:', () => {
      let stream, emitter

      setup(done => {
        stream = new Readable()
        stream._read = () => {}

        emitter = walk(stream)

        stream.push('{foo:{}}')
        stream.push(null)

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

      test('dataError event occurred once', () => {
        assert.strictEqual(log.counts.dataError, 3)
      })

      test('dataError event was dispatched correctly first time', () => {
        assert.strictEqual(log.args.dataError[0][0].actual, 'f')
        assert.strictEqual(log.args.dataError[0][0].expected, '"')
        assert.strictEqual(log.args.dataError[0][0].lineNumber, 1)
        assert.strictEqual(log.args.dataError[0][0].columnNumber, 2)
      })

      test('dataError event was dispatched correctly second time', () => {
        assert.strictEqual(log.args.dataError[1][0].actual, 'EOF')
        assert.strictEqual(log.args.dataError[1][0].expected, '"')
        assert.strictEqual(log.args.dataError[1][0].lineNumber, 1)
        assert.strictEqual(log.args.dataError[1][0].columnNumber, 9)
      })

      test('dataError event was dispatched correctly third time', () => {
        assert.strictEqual(log.args.dataError[2][0].actual, 'EOF')
        assert.strictEqual(log.args.dataError[2][0].expected, '}')
        assert.strictEqual(log.args.dataError[2][0].lineNumber, 1)
        assert.strictEqual(log.args.dataError[2][0].columnNumber, 9)
      })

      test('end event occurred once', () => {
        assert.strictEqual(log.counts.end, 1)
      })
    })

    suite('duplicate property:', () => {
      let stream, emitter

      setup(done => {
        stream = new Readable()
        stream._read = () => {}

        emitter = walk(stream)

        // NOTE: RFC 7159 is wishy washy on the subject of duplicates:
        //
        //   "The names within an object SHOULD be unique
        //
        //   ...
        //
        //   An object whose names are all unique is interoperable
        //   in the sense that all software implementations receiving
        //   that object will agree on the name/value mappings. When
        //   the names within an object are not unique, the behavior
        //   of software that receives such an object is unpredictable.
        //   Many implementations report the last name/value pair only.
        //   Other implementations report an error or fail to parse the
        //   object, and some implementations report all of the name/value
        //   pairs, including duplicates."
        //
        //   https://tools.ietf.org/html/rfc7159#section-4
        stream.push('{"foo":{},"foo":{}}')
        stream.push(null)

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

      test('property event occurred twice', () => {
        assert.strictEqual(log.counts.property, 2)
      })

      test('property event was dispatched correctly first time', () => {
        assert.strictEqual(log.args.property[0][0], 'foo')
      })

      test('property event was dispatched correctly second time', () => {
        assert.strictEqual(log.args.property[1][0], 'foo')
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

    suite('empty array containing whitespace:', () => {
      let stream, emitter

      setup(done => {
        stream = new Readable()
        stream._read = () => {}

        emitter = walk(stream)

        stream.push('[ ]')
        stream.push(null)

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

    suite('chunked empty array:', () => {
      let stream, emitter

      setup(done => {
        stream = new Readable()
        stream._read = () => {}

        emitter = walk(stream)

        stream.push('[')

        Object.keys(events).forEach(key => {
          emitter.on(events[key], spooks.fn({
            name: key,
            log: log
          }))
        })

        emitter.on(events.end, done)
        emitter.on(events.array, stream.push.bind(stream, ']'))
        emitter.on(events.endArray, stream.push.bind(stream, null))
      })

      test('array event occurred once', () => {
        assert.strictEqual(log.counts.array, 1)
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

    suite('chunked empty object with whitespace:', () => {
      let stream, emitter

      setup(done => {
        stream = new Readable()
        stream._read = () => {}

        emitter = walk(stream)

        stream.push(' {')

        Object.keys(events).forEach(key => {
          emitter.on(events[key], spooks.fn({
            name: key,
            log: log
          }))
        })

        emitter.on(events.end, done)

        emitter.on(events.object, () => {
          setTimeout(stream.push.bind(stream, ' }'), 20)
        })

        emitter.on(events.endObject, () => {
          setTimeout(stream.push.bind(stream, null), 20)
        })
      })

      test('object event occurred once', () => {
        assert.strictEqual(log.counts.object, 1)
      })

      test('endObject event occurred once', () => {
        assert.strictEqual(log.counts.endObject, 1)
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

    suite('chunked string:', () => {
      let stream, emitter

      setup(done => {
        stream = new Readable()
        stream._read = () => {}

        emitter = walk(stream)

        stream.push('"')

        Object.keys(events).forEach(key => {
          emitter.on(events[key], spooks.fn({
            name: key,
            log: log
          }))
        })

        emitter.on(events.end, done)

        emitter.on(events.string, () => {
          setTimeout(stream.push.bind(stream, null), 20)
        })

        setTimeout(stream.push.bind(stream, '\\'), 20)
        setTimeout(stream.push.bind(stream, 't\\u'), 40)
        setTimeout(stream.push.bind(stream, '00'), 60)
        setTimeout(stream.push.bind(stream, 'a0'), 80)
        setTimeout(stream.push.bind(stream, '"'), 100)
      })

      test('string event occurred once', () => {
        assert.strictEqual(log.counts.string, 1)
      })

      test('string event was dispatched correctly', () => {
        assert.strictEqual(log.args.string[0][0], '\t\u00a0')
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

    suite('chunked number:', () => {
      let stream, emitter

      setup(done => {
        stream = new Readable()
        stream._read = () => {}

        emitter = walk(stream)

        stream.push('-')

        Object.keys(events).forEach(key => {
          emitter.on(events[key], spooks.fn({
            name: key,
            log: log
          }))
        })

        emitter.on(events.end, done)

        setTimeout(stream.push.bind(stream, '3'), 20)
        setTimeout(stream.push.bind(stream, '.'), 40)
        setTimeout(stream.push.bind(stream, '14159'), 60)
        setTimeout(stream.push.bind(stream, '265359'), 80)
        setTimeout(stream.push.bind(stream, 'e'), 100)
        setTimeout(stream.push.bind(stream, '-'), 120)
        setTimeout(stream.push.bind(stream, '7'), 140)
        setTimeout(stream.push.bind(stream, null), 160)
      })

      test('number event occurred once', () => {
        assert.strictEqual(log.counts.number, 1)
      })

      test('number event was dispatched correctly', () => {
        assert.strictEqual(log.args.number[0][0], -3.14159265359e-7)
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

    suite('chunked literal:', () => {
      let stream, emitter

      setup(done => {
        stream = new Readable()
        stream._read = () => {}

        emitter = walk(stream)

        stream.push('n')

        Object.keys(events).forEach(key => {
          emitter.on(events[key], spooks.fn({
            name: key,
            log: log
          }))
        })

        emitter.on(events.end, done)

        setTimeout(stream.push.bind(stream, 'u'), 20)
        setTimeout(stream.push.bind(stream, 'l'), 40)
        setTimeout(stream.push.bind(stream, 'l'), 60)
        setTimeout(stream.push.bind(stream, null), 80)
      })

      test('literal event occurred once', () => {
        assert.strictEqual(log.counts.literal, 1)
      })

      test('literal event was dispatched correctly', () => {
        assert.strictEqual(log.args.literal[0][0], null)
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

    suite('populated array with discard=1:', () => {
      let stream, emitter

      setup(done => {
        stream = new Readable()
        stream._read = () => {}

        emitter = walk(stream, { discard: 1 })

        stream.push(' ')

        Object.keys(events).forEach(key => {
          emitter.on(events[key], spooks.fn({
            name: key,
            log: log
          }))
        })

        emitter.on(events.end, done)

        emitter.on(events.array, () => {
          stream.push(' ""')
        })

        emitter.on(events.string, () => {
          stream.push(' ]')
        })

        emitter.on(events.endArray, () => {
          stream.push(null)
        })

        setImmediate(stream.push.bind(stream, '['))
      })

      test('array event occurred once', () => {
        assert.strictEqual(log.counts.array, 1)
      })

      test('string event was dispatched correctly', () => {
        assert.strictEqual(log.args.string[0][0], "")
      })

      test('endArray event occurred once', () => {
        assert.strictEqual(log.counts.endArray, 1)
      })

      test('end event occurred once', () => {
        assert.strictEqual(log.counts.end, 1)
      })

      test('string event occurred once', () => {
        assert.strictEqual(log.counts.string, 1)
      })

      test('error event did not occur', () => {
        assert.strictEqual(log.counts.error, 0)
      })

      test('dataError event did not occur', () => {
        assert.strictEqual(log.counts.dataError, 0)
      })
    })

    suite('throw errors from event handlers:', () => {
      let stream, emitter

      setup(done => {
        stream = new Readable()
        stream._read = () => {}

        emitter = walk(stream)

        stream.push('[null,false,true,0,"",{"foo":"bar"}]')
        stream.push(null)

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

      test('array event occurred once', () => {
        assert.strictEqual(log.counts.array, 1)
      })

      test('endArray event occurred once', () => {
        assert.strictEqual(log.counts.endArray, 1)
      })

      test('literal event occurred three times', () => {
        assert.strictEqual(log.counts.literal, 3)
      })

      test('number event occurred once', () => {
        assert.strictEqual(log.counts.number, 1)
      })

      test('string event occurred twice', () => {
        assert.strictEqual(log.counts.string, 2)
      })

      test('property event occurred once', () => {
        assert.strictEqual(log.counts.property, 1)
      })

      test('object event occurred once', () => {
        assert.strictEqual(log.counts.object, 1)
      })

      test('endObject event occurred once', () => {
        assert.strictEqual(log.counts.endObject, 1)
      })

      test('error event occurred eleven times', () => {
        assert.strictEqual(log.counts.error, 11)
      })

      test('end event occurred once', () => {
        assert.strictEqual(log.counts.end, 1)
      })

      test('dataError event did not occur', () => {
        assert.strictEqual(log.counts.dataError, 0)
      })
    })

    suite('error occurs on stream:', () => {
      let stream, emitter

      setup(done => {
        stream = new Readable()
        stream._read = () => {}

        emitter = walk(stream)

        Object.keys(events).forEach(key => {
          emitter.on(events[key], spooks.fn({
            name: key,
            log: log
          }))
        })

        stream.emit('error', new Error('wibble'))
        stream.push(null)

        emitter.on(events.end, done)
      })

      test('error event occurred once', () => {
        assert.strictEqual(log.counts.error, 1)
      })

      test('error event was dispatched correctly', () => {
        assert.strictEqual(log.args.error[0][0].message, 'wibble')
        assert.isUndefined(log.args.error[0][0].actual)
        assert.isUndefined(log.args.error[0][0].expected)
        assert.isUndefined(log.args.error[0][0].lineNumber)
        assert.isUndefined(log.args.error[0][0].columnNumber)
      })

      test('end event occurred once', () => {
        assert.strictEqual(log.counts.end, 1)
      })

      test('dataError event did not occur', () => {
        assert.strictEqual(log.counts.dataError, 0)
      })
    })

    suite('two values separated by newline:', () => {
      let stream, emitter

      setup(done => {
        stream = new Readable()
        stream._read = () => {}

        emitter = walk(stream)

        stream.push('[]\n"foo"')
        stream.push(null)

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

      test('endArray event occurred once', () => {
        assert.strictEqual(log.counts.endArray, 1)
      })

      test('string event occurred once', () => {
        assert.strictEqual(log.counts.string, 1)
      })

      test('dataError event occurred once', () => {
        assert.strictEqual(log.counts.dataError, 1)
      })

      test('end event occurred once', () => {
        assert.strictEqual(log.counts.end, 1)
      })

      test('endLine event did not occur', () => {
        assert.strictEqual(log.counts.endLine, 0)
      })
    })

    suite('two values separated by newline, ndjson=true:', () => {
      let stream, emitter

      setup(done => {
        stream = new Readable()
        stream._read = () => {}

        emitter = walk(stream, { ndjson: true })

        stream.push('[]\n"foo"')
        stream.push(null)

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

      test('endArray event occurred once', () => {
        assert.strictEqual(log.counts.endArray, 1)
      })

      test('string event occurred once', () => {
        assert.strictEqual(log.counts.string, 1)
      })

      test('endLine event occurred once', () => {
        assert.strictEqual(log.counts.endLine, 1)
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

    suite('two values separated by newline, ndjson=true, with embedded newlines in a value:', () => {
      let stream, emitter

      setup(done => {
        stream = new Readable()
        stream._read = () => {}

        emitter = walk(stream, { ndjson: true })

        stream.push('[\n\n\n"foo"\n\n,\n"bar"]\n"baz"')
        stream.push(null)

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

      test('endArray event occurred once', () => {
        assert.strictEqual(log.counts.endArray, 1)
      })

      test('string event occurred three times', () => {
        assert.strictEqual(log.counts.string, 3)
      })

      test('endLine event occurred once', () => {
        assert.strictEqual(log.counts.endLine, 1)
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

    suite('two values not separated by newline, ndjson=true:', () => {
      let stream, emitter

      setup(done => {
        stream = new Readable()
        stream._read = () => {}

        emitter = walk(stream, { ndjson: true })

        stream.push('[]"foo"')
        stream.push(null)

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

      test('endArray event occurred once', () => {
        assert.strictEqual(log.counts.endArray, 1)
      })

      test('end event occurred once', () => {
        assert.strictEqual(log.counts.end, 1)
      })

      test('dataError event occurred five times', () => {
        assert.strictEqual(log.counts.dataError, 5)
      })

      test('string event did not occurr', () => {
        assert.strictEqual(log.counts.string, 0)
      })

      test('endLine event did not occur', () => {
        assert.strictEqual(log.counts.endLine, 0)
      })
    })

    suite('two values separated by two newlines, ndjson=true:', () => {
      let stream, emitter

      setup(done => {
        stream = new Readable()
        stream._read = () => {}

        emitter = walk(stream, { ndjson: true })

        stream.push('[]\r\n\r\n"foo"')
        stream.push(null)

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

      test('endArray event occurred once', () => {
        assert.strictEqual(log.counts.endArray, 1)
      })

      test('string event occurred once', () => {
        assert.strictEqual(log.counts.string, 1)
      })

      test('endLine event occurred twice', () => {
        assert.strictEqual(log.counts.endLine, 2)
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

    suite('chunked ndjson:', () => {
      let stream, emitter

      setup(done => {
        stream = new Readable()
        stream._read = () => {}

        emitter = walk(stream, { ndjson: true })

        stream.push('[]')

        Object.keys(events).forEach(key => {
          emitter.on(events[key], spooks.fn({
            name: key,
            log: log
          }))
        })

        emitter.on(events.end, done)

        setTimeout(stream.push.bind(stream, ' '), 20)
        setTimeout(stream.push.bind(stream, '\n'), 40)
        setTimeout(stream.push.bind(stream, ' '), 60)
        setTimeout(stream.push.bind(stream, '"'), 80)
        setTimeout(stream.push.bind(stream, 'foo"'), 100)
        setTimeout(stream.push.bind(stream, null), 120)
      })

      test('array event occurred once', () => {
        assert.strictEqual(log.counts.array, 1)
      })

      test('endArray event occurred once', () => {
        assert.strictEqual(log.counts.endArray, 1)
      })

      test('endLine event occurred once', () => {
        assert.strictEqual(log.counts.endLine, 1)
      })

      test('string event occurred once', () => {
        assert.strictEqual(log.counts.string, 1)
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
  })
})
