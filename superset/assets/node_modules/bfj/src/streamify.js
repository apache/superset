'use strict'

const check = require('check-types')
const eventify = require('./eventify')
const events = require('./events')
const JsonStream = require('./jsonstream')
const Hoopy = require('hoopy')
const promise = require('./promise')
const tryer = require('tryer')

const DEFAULT_BUFFER_LENGTH = 1024

module.exports = streamify

/**
 * Public function `streamify`.
 *
 * Asynchronously serialises a data structure to a stream of JSON
 * data. Sanely handles promises, buffers, maps and other iterables.
 *
 * @param data:           The data to transform.
 *
 * @option space:         Indentation string, or the number of spaces
 *                        to indent each nested level by.
 *
 * @option promises:      'resolve' or 'ignore', default is 'resolve'.
 *
 * @option buffers:       'toString' or 'ignore', default is 'toString'.
 *
 * @option maps:          'object' or 'ignore', default is 'object'.
 *
 * @option iterables:     'array' or 'ignore', default is 'array'.
 *
 * @option circular:      'error' or 'ignore', default is 'error'.
 *
 * @option yieldRate:     The number of data items to process per timeslice,
 *                        default is 16384.
 *
 * @option bufferLength:  The length of the buffer, default is 1024.
 *
 * @option highWaterMark: If set, will be passed to the readable stream constructor
 *                        as the value for the highWaterMark option.
 *
 * @option Promise:       The promise constructor to use, defaults to bluebird.
 **/
function streamify (data, options = {}) {
  const emitter = eventify(data, options)
  const json = new Hoopy(options.bufferLength || DEFAULT_BUFFER_LENGTH)
  const Promise = promise(options)
  const space = normaliseSpace(options)
  let streamOptions
  const { highWaterMark } = options
  if (highWaterMark) {
    streamOptions = { highWaterMark }
  }
  const stream = new JsonStream(read, streamOptions)

  let awaitPush = true
  let index = 0
  let indentation = ''
  let isEnded
  let isPaused = false
  let isProperty
  let length = 0
  let mutex = Promise.resolve()
  let needsComma

  emitter.on(events.array, noRacing(array))
  emitter.on(events.object, noRacing(object))
  emitter.on(events.property, noRacing(property))
  emitter.on(events.string, noRacing(string))
  emitter.on(events.number, noRacing(value))
  emitter.on(events.literal, noRacing(value))
  emitter.on(events.endArray, noRacing(endArray))
  emitter.on(events.endObject, noRacing(endObject))
  emitter.on(events.end, noRacing(end))
  emitter.on(events.error, noRacing(error))
  emitter.on(events.dataError, noRacing(dataError))

  return stream

  function read () {
    if (awaitPush) {
      awaitPush = false

      if (isEnded) {
        if (length > 0) {
          after()
        }

        return endStream()
      }
    }

    if (isPaused) {
      after()
    }
  }

  function after () {
    if (awaitPush) {
      return
    }

    let i

    for (i = 0; i < length && ! awaitPush; ++i) {
      if (! stream.push(json[i + index], 'utf8')) {
        awaitPush = true
      }
    }

    if (i === length) {
      index = length = 0
    } else {
      length -= i
      index += i
    }
  }

  function endStream () {
    if (! awaitPush) {
      stream.push(null)
    }
  }

  function noRacing (handler) {
    return eventData => mutex = mutex.then(() => handler(eventData))
  }

  function array () {
    return beforeScope()
      .then(() => addJson('['))
      .then(() => afterScope())
  }

  function beforeScope () {
    return before(true)
  }

  function before (isScope) {
    if (isProperty) {
      isProperty = false

      if (space) {
        return addJson(' ')
      }

      return Promise.resolve()
    }

    return Promise.resolve()
      .then(() => {
        if (needsComma) {
          if (isScope) {
            needsComma = false
          }

          return addJson(',')
        }

        if (! isScope) {
          needsComma = true
        }
      })
      .then(() => {
        if (space && indentation) {
          return indent()
        }
      })
  }

  function addJson (chunk) {
    if (length + 1 <= json.length) {
      json[index + length++] = chunk
      after()
      return Promise.resolve()
    }

    isPaused = true
    return new Promise(resolve => {
      const unpause = emitter.pause()
      tryer({
        interval: -10,
        until () {
          return length + 1 <= json.length
        },
        pass () {
          isPaused = false
          json[index + length++] = chunk
          resolve()
          setImmediate(unpause)
        }
      })
    })
  }

  function indent () {
    return addJson(`\n${indentation}`)
  }

  function afterScope () {
    needsComma = false

    if (space) {
      indentation += space
    }
  }

  function object () {
    return beforeScope()
      .then(() => addJson('{'))
      .then(() => afterScope())
  }

  function property (name) {
    return before()
      .then(() => addJson(`"${name}":`))
      .then(() => {
        isProperty = true
      })
  }

  function string (s) {
    return value(`"${s}"`)
  }

  function value (v) {
    return before()
      .then(() => addJson(`${v}`))
  }

  function endArray () {
    return beforeScopeEnd()
      .then(() => addJson(']'))
      .then(() => afterScopeEnd())
  }

  function beforeScopeEnd () {
    if (space) {
      indentation = indentation.substr(space.length)

      return indent()
    }

    return Promise.resolve()
  }

  function afterScopeEnd () {
    needsComma = true
  }

  function endObject () {
    return beforeScopeEnd()
      .then(() => addJson('}'))
      .then(() => afterScopeEnd())
  }

  function end () {
    after()

    isEnded = true
    endStream()
  }

  function error (err) {
    stream.emit('error', err)
  }

  function dataError (err) {
    stream.emit('dataError', err)
  }
}

function normaliseSpace (options) {
  if (check.positive(options.space)) {
    return new Array(options.space + 1).join(' ')
  }

  if (check.nonEmptyString(options.space)) {
    return options.space
  }
}
