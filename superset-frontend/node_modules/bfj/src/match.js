'use strict'

const check = require('check-types')
const DataStream = require('./datastream')
const events = require('./events')
const Hoopy = require('hoopy')
const walk = require('./walk')

const DEFAULT_BUFFER_LENGTH = 1024

module.exports = match

/**
 * Public function `match`.
 *
 * Asynchronously parses a stream of JSON data, returning a stream of items
 * that match the argument. Note that if a value is `null`, it won't be matched
 * because `null` is used to signify end-of-stream in node.
 *
 * @param stream:         Readable instance representing the incoming JSON.
 *
 * @param selector:       Regular expression, string or predicate function used to
 *                        identify matches. If a regular expression or string is
 *                        passed, only property keys are tested. If a predicate is
 *                        passed, both the key and the value are passed to it as
 *                        arguments.
 *
 * @option numbers:       Boolean, indicating whether numerical keys (e.g. array
 *                        indices) should be coerced to strings before testing the
 *                        match. Only applies if the `selector` argument is a string
 *                        or regular expression.
 *
 * @option ndjson:        Set this to true to parse newline-delimited JSON,
 *                        default is `false`.
 *
 * @option yieldRate:     The number of data items to process per timeslice,
 *                        default is 16384.
 *
 * @option bufferLength:  The length of the match buffer, default is 1024.
 *
 * @option highWaterMark: If set, will be passed to the readable stream constructor
 *                        as the value for the highWaterMark option.
 *
 * @option Promise:       The promise constructor to use, defaults to bluebird.
 **/
function match (stream, selector, options = {}) {
  const scopes = []
  const properties = []
  const emitter = walk(stream, options)
  const matches = new Hoopy(options.bufferLength || DEFAULT_BUFFER_LENGTH)
  let streamOptions
  const { highWaterMark } = options
  if (highWaterMark) {
    streamOptions = { highWaterMark }
  }
  const results = new DataStream(read, streamOptions)

  let selectorFunction, selectorString, resume
  let coerceNumbers = false
  let awaitPush = true
  let isEnded = false
  let length = 0
  let index = 0

  if (check.function(selector)) {
    selectorFunction = selector
    selector = null
  } else {
    coerceNumbers = !! options.numbers

    if (check.string(selector)) {
      check.assert.nonEmptyString(selector)
      selectorString = selector
      selector = null
    } else {
      check.assert.instanceStrict(selector, RegExp)
    }
  }

  emitter.on(events.array, array)
  emitter.on(events.object, object)
  emitter.on(events.property, property)
  emitter.on(events.endArray, endScope)
  emitter.on(events.endObject, endScope)
  emitter.on(events.string, value)
  emitter.on(events.number, value)
  emitter.on(events.literal, value)
  emitter.on(events.end, end)
  emitter.on(events.error, error)
  emitter.on(events.dataError, dataError)

  return results

  function read () {
    if (awaitPush) {
      awaitPush = false

      if (isEnded) {
        if (length > 0) {
          after()
        }

        return endResults()
      }
    }

    if (resume) {
      const resumeCopy = resume
      resume = null
      resumeCopy()
      after()
    }
  }

  function after () {
    if (awaitPush || resume) {
      return
    }

    let i

    for (i = 0; i < length && ! resume; ++i) {
      if (! results.push(matches[i + index])) {
        pause()
      }
    }

    if (i === length) {
      index = length = 0
    } else {
      length -= i
      index += i
    }
  }

  function pause () {
    resume = emitter.pause()
  }

  function endResults () {
    if (! awaitPush) {
      results.push(null)
    }
  }

  function array () {
    scopes.push([])
  }

  function object () {
    scopes.push({})
  }

  function property (name) {
    properties.push(name)
  }

  function endScope () {
    value(scopes.pop())
  }

  function value (v) {
    let key

    if (scopes.length > 0) {
      const scope = scopes[scopes.length - 1]

      if (Array.isArray(scope)) {
        key = scope.length
      } else {
        key = properties.pop()
      }

      scope[key] = v
    }

    if (v === null) {
      return
    }

    if (selectorFunction) {
      if (selectorFunction(key, v, scopes.length)) {
        push(v)
      }
    } else {
      if (coerceNumbers && typeof key === 'number') {
        key = key.toString()
      }

      if ((selectorString && selectorString === key) || (selector && selector.test(key))) {
        push(v)
      }
    }
  }

  function push (v) {
    if (length + 1 === matches.length) {
      pause()
    }

    matches[index + length++] = v

    after()
  }

  function end () {
    isEnded = true
    endResults()
  }

  function error (e) {
    results.emit('error', e)
  }

  function dataError (e) {
    results.emit('dataError', e)
  }
}
