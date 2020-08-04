'use strict'

const check = require('check-types')
const EventEmitter = require('events').EventEmitter
const events = require('./events')
const promise = require('./promise')

const invalidTypes = {
  undefined: true, // eslint-disable-line no-undefined
  function: true,
  symbol: true
}

module.exports = eventify

/**
 * Public function `eventify`.
 *
 * Returns an event emitter and asynchronously traverses a data structure
 * (depth-first), emitting events as it encounters items. Sanely handles
 * promises, buffers, maps and other iterables. The event emitter is
 * decorated with a `pause` method that can be called to pause processing.
 *
 * @param data:       The data structure to traverse.
 *
 * @option promises:  'resolve' or 'ignore', default is 'resolve'.
 *
 * @option buffers:   'toString' or 'ignore', default is 'toString'.
 *
 * @option maps:      'object' or 'ignore', default is 'object'.
 *
 * @option iterables:  'array' or 'ignore', default is 'array'.
 *
 * @option circular:   'error' or 'ignore', default is 'error'.
 *
 * @option yieldRate:  The number of data items to process per timeslice,
 *                     default is 16384.
 *
 * @option Promise:      The promise constructor to use, defaults to bluebird.
 **/
function eventify (data, options = {}) {
  const coercions = {}
  const emitter = new EventEmitter()
  const Promise = promise(options)
  const references = new Map()

  let count = 0
  let disableCoercions = false
  let ignoreCircularReferences
  let ignoreItems
  let pause
  let yieldRate

  emitter.pause = () => {
    let resolve
    pause = new Promise(res => resolve = res)
    return () => {
      pause = null
      count = 0
      resolve()
    }
  }
  parseOptions()
  setImmediate(begin)

  return emitter

  function parseOptions () {
    parseCoercionOption('promises')
    parseCoercionOption('buffers')
    parseCoercionOption('maps')
    parseCoercionOption('iterables')

    if (Object.keys(coercions).length === 0) {
      disableCoercions = true
    }

    if (options.circular === 'ignore') {
      ignoreCircularReferences = true
    }

    check.assert.maybe.positive(options.yieldRate)
    yieldRate = options.yieldRate || 16384
  }

  function parseCoercionOption (key) {
    if (options[key] !== 'ignore') {
      coercions[key] = true
    }
  }

  function begin () {
    return proceed(data)
      .catch(error => emit(events.error, error))
      .then(() => emit(events.end))
  }

  function proceed (datum) {
    if (++count % yieldRate !== 0) {
      return coerce(datum).then(after)
    }

    return new Promise((resolve, reject) => {
      setImmediate(() => {
        coerce(datum)
          .then(after)
          .then(resolve)
          .catch(reject)
      })
    })

    function after (coerced) {
      if (isInvalid(coerced)) {
        return
      }

      if (coerced === false || coerced === true || coerced === null) {
        return literal(coerced)
      }

      if (Array.isArray(coerced)) {
        return array(coerced)
      }

      const type = typeof coerced

      switch (type) {
        case 'number':
          return value(coerced, type)
        case 'string':
          return value(escapeString(coerced), type)
        default:
          return object(coerced)
      }
    }
  }

  function coerce (datum) {
    if (disableCoercions || check.primitive(datum)) {
      return Promise.resolve(datum)
    }

    if (check.instanceStrict(datum, Promise)) {
      return coerceThing(datum, 'promises', coercePromise).then(coerce)
    }

    if (check.instanceStrict(datum, Buffer)) {
      return coerceThing(datum, 'buffers', coerceBuffer)
    }

    if (check.instanceStrict(datum, Map)) {
      return coerceThing(datum, 'maps', coerceMap)
    }

    if (
      check.iterable(datum) &&
      check.not.string(datum) &&
      check.not.array(datum)
    ) {
      return coerceThing(datum, 'iterables', coerceIterable)
    }

    if (check.function(datum.toJSON)) {
      return Promise.resolve(datum.toJSON())
    }

    return Promise.resolve(datum)
  }

  function coerceThing (datum, thing, fn) {
    if (coercions[thing]) {
      return fn(datum)
    }

    return Promise.resolve()
  }

  function coercePromise (p) {
    return p
  }

  function coerceBuffer (buffer) {
    return Promise.resolve(buffer.toString())
  }

  function coerceMap (map) {
    const result = {}

    return coerceCollection(map, result, (item, key) => {
      result[key] = item
    })
  }

  function coerceCollection (coll, target, push) {
    coll.forEach(push)

    return Promise.resolve(target)
  }

  function coerceIterable (iterable) {
    const result = []

    return coerceCollection(iterable, result, item => {
      result.push(item)
    })
  }

  function isInvalid (datum) {
    const type = typeof datum
    return !! invalidTypes[type] || (
      type === 'number' && ! isValidNumber(datum)
    )
  }

  function isValidNumber (datum) {
    return datum > Number.NEGATIVE_INFINITY && datum < Number.POSITIVE_INFINITY
  }

  function literal (datum) {
    return value(datum, 'literal')
  }

  function value (datum, type) {
    return emit(events[type], datum)
  }

  function emit (event, eventData) {
    return (pause || Promise.resolve())
      .then(() => emitter.emit(event, eventData))
      .catch(err => {
        try {
          emitter.emit(events.error, err)
        } catch (_) {
          // When calling user code, anything is possible
        }
      })
  }

  function array (datum) {
    // For an array, collection:object and collection:array are the same.
    return collection(datum, datum, 'array', item => {
      if (isInvalid(item)) {
        return proceed(null)
      }

      return proceed(item)
    })
  }

  function collection (obj, arr, type, action) {
    let ignoreThisItem

    return Promise.resolve()
      .then(() => {
        if (references.has(obj)) {
          ignoreThisItem = ignoreItems = true

          if (! ignoreCircularReferences) {
            return emit(events.dataError, new Error('Circular reference.'))
          }
        } else {
          references.set(obj, true)
        }
      })
      .then(() => emit(events[type]))
      .then(() => item(0))

    function item (index) {
      if (index >= arr.length) {
        if (ignoreThisItem) {
          ignoreItems = false
        }

        if (ignoreItems) {
          return Promise.resolve()
        }

        return emit(events.endPrefix + events[type])
          .then(() => references.delete(obj))
      }

      if (ignoreItems) {
        return item(index + 1)
      }

      return action(arr[index])
        .then(() => item(index + 1))
    }
  }

  function object (datum) {
    // For an object, collection:object and collection:array are different.
    return collection(datum, Object.keys(datum), 'object', key => {
      const item = datum[key]

      if (isInvalid(item)) {
        return Promise.resolve()
      }

      return emit(events.property, escapeString(key))
        .then(() => proceed(item))
    })
  }

  function escapeString (string) {
    string = JSON.stringify(string)
    return string.substring(1, string.length - 1)
  }
}
