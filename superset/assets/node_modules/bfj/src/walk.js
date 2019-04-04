'use strict'

const check = require('check-types')
const error = require('./error')
const EventEmitter = require('events').EventEmitter
const events = require('./events')
const promise = require('./promise')

const terminators = {
  obj: '}',
  arr: ']'
}

const escapes = {
  /* eslint-disable quote-props */
  '"': '"',
  '\\': '\\',
  '/': '/',
  'b': '\b',
  'f': '\f',
  'n': '\n',
  'r': '\r',
  't': '\t'
  /* eslint-enable quote-props */
}

module.exports = initialise

/**
 * Public function `walk`.
 *
 * Returns an event emitter and asynchronously walks a stream of JSON data,
 * emitting events as it encounters tokens. The event emitter is decorated
 * with a `pause` method that can be called to pause processing.
 *
 * @param stream:     Readable instance representing the incoming JSON.
 *
 * @option yieldRate: The number of data items to process per timeslice,
 *                    default is 16384.
 *
 * @option Promise:   The promise constructor to use, defaults to bluebird.
 *
 * @option ndjson:    Set this to true to parse newline-delimited JSON.
 **/
function initialise (stream, options = {}) {
  check.assert.instanceStrict(stream, require('stream').Readable, 'Invalid stream argument')

  const currentPosition = {
    line: 1,
    column: 1
  }
  const emitter = new EventEmitter()
  const handlers = {
    arr: value,
    obj: property
  }
  const json = []
  const lengths = []
  const previousPosition = {}
  const Promise = promise(options)
  const scopes = []
  const yieldRate = options.yieldRate || 16384
  const shouldHandleNdjson = !! options.ndjson

  let index = 0
  let isStreamEnded = false
  let isWalkBegun = false
  let isWalkEnded = false
  let isWalkingString = false
  let hasEndedLine = true
  let count = 0
  let resumeFn
  let pause
  let cachedCharacter

  stream.setEncoding('utf8')
  stream.on('data', readStream)
  stream.on('end', endStream)
  stream.on('error', err => {
    emitter.emit(events.error, err)
    endStream()
  })

  emitter.pause = () => {
    let resolve
    pause = new Promise(res => resolve = res)
    return () => {
      pause = null
      count = 0

      if (shouldHandleNdjson && isStreamEnded && isWalkEnded) {
        emit(events.end)
      } else {
        resolve()
      }
    }
  }

  return emitter

  function readStream (chunk) {
    addChunk(chunk)

    if (isWalkBegun) {
      return resume()
    }

    isWalkBegun = true
    value()
  }

  function addChunk (chunk) {
    json.push(chunk)

    const chunkLength = chunk.length
    lengths.push({
      item: chunkLength,
      aggregate: length() + chunkLength
    })
  }

  function length () {
    const chunkCount = lengths.length

    if (chunkCount === 0) {
      return 0
    }

    return lengths[chunkCount - 1].aggregate
  }

  function value () {
    /* eslint-disable no-underscore-dangle */
    if (++count % yieldRate !== 0) {
      return _do()
    }

    return new Promise(resolve => {
      setImmediate(() => _do().then(resolve))
    })

    function _do () {
      return awaitNonWhitespace()
        .then(next)
        .then(handleValue)
        .catch(() => {})
    }
    /* eslint-enable no-underscore-dangle */
  }

  function awaitNonWhitespace () {
    return wait()

    function wait () {
      return awaitCharacter()
        .then(step)
    }

    function step () {
      if (isWhitespace(character())) {
        return next().then(wait)
      }
    }
  }

  function awaitCharacter () {
    let resolve, reject

    if (index < length()) {
      return Promise.resolve()
    }

    if (isStreamEnded) {
      setImmediate(endWalk)
      return Promise.reject()
    }

    resumeFn = after

    return new Promise((res, rej) => {
      resolve = res
      reject = rej
    })

    function after () {
      if (index < length()) {
        return resolve()
      }

      reject()

      if (isStreamEnded) {
        setImmediate(endWalk)
      }
    }
  }

  function character () {
    if (cachedCharacter) {
      return cachedCharacter
    }

    if (lengths[0].item > index) {
      return cachedCharacter = json[0][index]
    }

    const len = lengths.length
    for (let i = 1; i < len; ++i) {
      const { aggregate, item } = lengths[i]
      if (aggregate > index) {
        return cachedCharacter = json[i][index + item - aggregate]
      }
    }
  }

  function isWhitespace (char) {
    switch (char) {
      case '\n':
        if (shouldHandleNdjson && scopes.length === 0) {
          return false
        }
      case ' ':
      case '\t':
      case '\r':
        return true
    }

    return false
  }

  function next () {
    return awaitCharacter().then(after)

    function after () {
      const result = character()

      cachedCharacter = null
      index += 1
      previousPosition.line = currentPosition.line
      previousPosition.column = currentPosition.column

      if (result === '\n') {
        currentPosition.line += 1
        currentPosition.column = 1
      } else {
        currentPosition.column += 1
      }

      if (index > lengths[0].aggregate) {
        json.shift()

        const difference = lengths.shift().item
        index -= difference

        lengths.forEach(len => len.aggregate -= difference)
      }

      return result
    }
  }

  function handleValue (char) {
    if (shouldHandleNdjson && scopes.length === 0) {
      if (char === '\n') {
        hasEndedLine = true
        return emit(events.endLine)
          .then(value)
      }

      if (! hasEndedLine) {
        return fail(char, '\n', previousPosition)
          .then(value)
      }

      hasEndedLine = false
    }

    switch (char) {
      case '[':
        return array()
      case '{':
        return object()
      case '"':
        return string()
      case '0':
      case '1':
      case '2':
      case '3':
      case '4':
      case '5':
      case '6':
      case '7':
      case '8':
      case '9':
      case '-':
      case '.':
        return number(char)
      case 'f':
        return literalFalse()
      case 'n':
        return literalNull()
      case 't':
        return literalTrue()
      default:
        return fail(char, 'value', previousPosition)
          .then(value)
    }
  }

  function array () {
    return scope(events.array, value)
  }

  function scope (event, contentHandler) {
    return emit(event)
      .then(() => {
        scopes.push(event)
        return endScope(event)
      })
      .then(contentHandler)
  }

  function emit (...args) {
    return (pause || Promise.resolve())
      .then(() => {
        try {
          emitter.emit(...args)
        } catch (err) {
          try {
            emitter.emit(events.error, err)
          } catch (_) {
            // When calling user code, anything is possible
          }
        }
      })
  }

  function endScope (scp) {
    return awaitNonWhitespace()
      .then(() => {
        if (character() === terminators[scp]) {
          return emit(events.endPrefix + scp)
            .then(() => {
              scopes.pop()
              return next()
            })
            .then(endValue)
        }
      })
      .catch(endWalk)
  }

  function endValue () {
    return awaitNonWhitespace()
      .then(after)
      .catch(endWalk)

    function after () {
      if (scopes.length === 0) {
        if (shouldHandleNdjson) {
          return value()
        }

        return fail(character(), 'EOF', currentPosition)
          .then(value)
      }

      return checkScope()
    }

    function checkScope () {
      const scp = scopes[scopes.length - 1]
      const handler = handlers[scp]

      return endScope(scp)
        .then(() => {
          if (scopes.length > 0) {
            return checkCharacter(character(), ',', currentPosition)
          }
        })
        .then(result => {
          if (result) {
            return next()
          }
        })
        .then(handler)
    }
  }

  function fail (actual, expected, position) {
    return emit(
      events.dataError,
      error.create(
        actual,
        expected,
        position.line,
        position.column
      )
    )
  }

  function checkCharacter (char, expected, position) {
    if (char === expected) {
      return Promise.resolve(true)
    }

    return fail(char, expected, position)
      .then(false)
  }

  function object () {
    return scope(events.object, property)
  }

  function property () {
    return awaitNonWhitespace()
      .then(next)
      .then(propertyName)
  }

  function propertyName (char) {
    return checkCharacter(char, '"', previousPosition)
      .then(() => walkString(events.property))
      .then(awaitNonWhitespace)
      .then(next)
      .then(propertyValue)
  }

  function propertyValue (char) {
    return checkCharacter(char, ':', previousPosition)
      .then(value)
  }

  function walkString (event) {
    let isEscaping = false
    const str = []

    isWalkingString = true

    return next().then(step)

    function step (char) {
      if (isEscaping) {
        isEscaping = false

        return escape(char).then(escaped => {
          str.push(escaped)
          return next().then(step)
        })
      }

      if (char === '\\') {
        isEscaping = true
        return next().then(step)
      }

      if (char !== '"') {
        str.push(char)
        return next().then(step)
      }

      isWalkingString = false
      return emit(event, str.join(''))
    }
  }

  function escape (char) {
    if (escapes[char]) {
      return Promise.resolve(escapes[char])
    }

    if (char === 'u') {
      return escapeHex()
    }

    return fail(char, 'escape character', previousPosition)
      .then(() => `\\${char}`)
  }

  function escapeHex () {
    let hexits = []

    return next().then(step.bind(null, 0))

    function step (idx, char) {
      if (isHexit(char)) {
        hexits.push(char)
      }

      if (idx < 3) {
        return next().then(step.bind(null, idx + 1))
      }

      hexits = hexits.join('')

      if (hexits.length === 4) {
        return String.fromCharCode(parseInt(hexits, 16))
      }

      return fail(char, 'hex digit', previousPosition)
        .then(() => `\\u${hexits}${char}`)
    }
  }

  function string () {
    return walkString(events.string).then(endValue)
  }

  function number (firstCharacter) {
    let digits = [ firstCharacter ]

    return walkDigits().then(addDigits.bind(null, checkDecimalPlace))

    function addDigits (step, result) {
      digits = digits.concat(result.digits)

      if (result.atEnd) {
        return endNumber()
      }

      return step()
    }

    function checkDecimalPlace () {
      if (character() === '.') {
        return next()
          .then(char => {
            digits.push(char)
            return walkDigits()
          })
          .then(addDigits.bind(null, checkExponent))
      }

      return checkExponent()
    }

    function checkExponent () {
      if (character() === 'e' || character() === 'E') {
        return next()
          .then(char => {
            digits.push(char)
            return awaitCharacter()
          })
          .then(checkSign)
          .catch(fail.bind(null, 'EOF', 'exponent', currentPosition))
      }

      return endNumber()
    }

    function checkSign () {
      if (character() === '+' || character() === '-') {
        return next().then(char => {
          digits.push(char)
          return readExponent()
        })
      }

      return readExponent()
    }

    function readExponent () {
      return walkDigits().then(addDigits.bind(null, endNumber))
    }

    function endNumber () {
      return emit(events.number, parseFloat(digits.join('')))
        .then(endValue)
    }
  }

  function walkDigits () {
    const digits = []

    return wait()

    function wait () {
      return awaitCharacter()
        .then(step)
        .catch(atEnd)
    }

    function step () {
      if (isDigit(character())) {
        return next().then(char => {
          digits.push(char)
          return wait()
        })
      }

      return { digits, atEnd: false }
    }

    function atEnd () {
      return { digits, atEnd: true }
    }
  }

  function literalFalse () {
    return literal([ 'a', 'l', 's', 'e' ], false)
  }

  function literal (expectedCharacters, val) {
    let actual, expected, invalid

    return wait()

    function wait () {
      return awaitCharacter()
        .then(step)
        .catch(atEnd)
    }

    function step () {
      if (invalid || expectedCharacters.length === 0) {
        return atEnd()
      }

      return next().then(afterNext)
    }

    function atEnd () {
      return Promise.resolve()
        .then(() => {
          if (invalid) {
            return fail(actual, expected, previousPosition)
          }

          if (expectedCharacters.length > 0) {
            return fail('EOF', expectedCharacters.shift(), currentPosition)
          }

          return done()
        })
        .then(endValue)
    }

    function afterNext (char) {
      actual = char
      expected = expectedCharacters.shift()

      if (actual !== expected) {
        invalid = true
      }

      return wait()
    }

    function done () {
      return emit(events.literal, val)
    }
  }

  function literalNull () {
    return literal([ 'u', 'l', 'l' ], null)
  }

  function literalTrue () {
    return literal([ 'r', 'u', 'e' ], true)
  }

  function endStream () {
    isStreamEnded = true

    if (isWalkBegun) {
      return resume()
    }

    endWalk()
  }

  function resume () {
    if (resumeFn) {
      resumeFn()
      resumeFn = null
    }
  }

  function endWalk () {
    if (isWalkEnded) {
      return Promise.resolve()
    }

    isWalkEnded = true

    return Promise.resolve()
      .then(() => {
        if (isWalkingString) {
          return fail('EOF', '"', currentPosition)
        }
      })
      .then(popScopes)
      .then(() => emit(events.end))
  }

  function popScopes () {
    if (scopes.length === 0) {
      return Promise.resolve()
    }

    return fail('EOF', terminators[scopes.pop()], currentPosition)
      .then(popScopes)
  }
}

function isHexit (character) {
  return isDigit(character) ||
    isInRange(character, 'A', 'F') ||
    isInRange(character, 'a', 'f')
}

function isDigit (character) {
  return isInRange(character, '0', '9')
}

function isInRange (character, lower, upper) {
  const code = character.charCodeAt(0)

  return code >= lower.charCodeAt(0) && code <= upper.charCodeAt(0)
}
