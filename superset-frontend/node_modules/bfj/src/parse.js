'use strict'

const check = require('check-types')
const events = require('./events')
const promise = require('./promise')
const walk = require('./walk')

module.exports = parse

const NDJSON_STATE = new Map()

/**
 * Public function `parse`.
 *
 * Returns a promise and asynchronously parses a stream of JSON data. If
 * there are no errors, the promise is resolved with the parsed data. If
 * errors occur, the promise is rejected with the first error.
 *
 * @param stream:     Readable instance representing the incoming JSON.
 *
 * @option reviver:   Transformation function, invoked depth-first.
 *
 * @option yieldRate: The number of data items to process per timeslice,
 *                    default is 16384.
 *
 * @option Promise:   The promise constructor to use, defaults to bluebird.
 *
 * @option ndjson:    Set this to true to parse newline-delimited JSON. In
 *                    this case, each call will be resolved with one value
 *                    from the stream. To parse the entire stream, calls
 *                    should be made sequentially one-at-a-time until the
 *                    returned promise resolves to `undefined`.
 **/
function parse (stream, options = {}) {
  const Promise = promise(options)

  try {
    check.assert.maybe.function(options.reviver, 'Invalid reviver option')
  } catch (err) {
    return Promise.reject(err)
  }

  const errors = []
  const scopes = []
  const reviver = options.reviver
  const shouldHandleNdjson = !! options.ndjson

  let emitter, resolve, reject, scopeKey
  if (shouldHandleNdjson && NDJSON_STATE.has(stream)) {
    const state = NDJSON_STATE.get(stream)
    NDJSON_STATE.delete(stream)
    emitter = state.emitter
    setImmediate(state.resume)
  } else {
    emitter = walk(stream, options)
  }

  emitter.on(events.array, array)
  emitter.on(events.object, object)
  emitter.on(events.property, property)
  emitter.on(events.string, value)
  emitter.on(events.number, value)
  emitter.on(events.literal, value)
  emitter.on(events.endArray, endScope)
  emitter.on(events.endObject, endScope)
  emitter.on(events.end, end)
  emitter.on(events.error, error)
  emitter.on(events.dataError, error)

  if (shouldHandleNdjson) {
    emitter.on(events.endLine, endLine)
  }

  return new Promise((res, rej) => {
    resolve = res
    reject = rej
  })

  function array () {
    if (errors.length > 0) {
      return
    }

    beginScope([])
  }

  function beginScope (parsed) {
    if (errors.length > 0) {
      return
    }

    if (scopes.length > 0) {
      value(parsed)
    }

    scopes.push(parsed)
  }

  function value (v) {
    if (errors.length > 0) {
      return
    }

    if (scopes.length === 0) {
      return scopes.push(v)
    }

    const scope = scopes[scopes.length - 1]

    if (scopeKey) {
      scope[scopeKey] = v
      scopeKey = null
    } else {
      scope.push(v)
    }
  }

  function object () {
    if (errors.length > 0) {
      return
    }

    beginScope({})
  }

  function property (name) {
    if (errors.length > 0) {
      return
    }

    scopeKey = name
  }

  function endScope () {
    if (errors.length > 0) {
      return
    }

    if (scopes.length > 1) {
      scopes.pop()
    }
  }

  function end () {
    if (shouldHandleNdjson) {
      const resume = emitter.pause()
      emitter.removeAllListeners()
      NDJSON_STATE.set(stream, { emitter, resume })
    }

    if (errors.length > 0) {
      return reject(errors[0])
    }

    if (reviver) {
      scopes[0] = transform(scopes[0], '')
    }

    resolve(scopes[0])
  }

  function transform (obj, key) {
    if (obj && typeof obj === 'object') {
      Object.keys(obj).forEach(childKey => {
        obj[childKey] = transform(obj[childKey], childKey)
      })
    }

    return reviver(key, obj)
  }

  function error (e) {
    errors.push(e)
  }

  function endLine () {
    if (scopes.length > 0) {
      end()
    }
  }
}
