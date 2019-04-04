'use strict'

const promise = require('./promise')
const streamify = require('./streamify')

module.exports = stringify

/**
 * Public function `stringify`.
 *
 * Returns a promise and asynchronously serialises a data structure to a
 * JSON string. Sanely handles promises, buffers, maps and other iterables.
 *
 * @param data:          The data to transform
 *
 * @option space:        Indentation string, or the number of spaces
 *                       to indent each nested level by.
 *
 * @option promises:     'resolve' or 'ignore', default is 'resolve'.
 *
 * @option buffers:      'toString' or 'ignore', default is 'toString'.
 *
 * @option maps:         'object' or 'ignore', default is 'object'.
 *
 * @option iterables:    'array' or 'ignore', default is 'array'.
 *
 * @option circular:     'error' or 'ignore', default is 'error'.
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
function stringify (data, options) {
  const json = []
  const Promise = promise(options)
  const stream = streamify(data, options)

  let resolve, reject

  stream.on('data', read)
  stream.on('end', end)
  stream.on('error', error)
  stream.on('dataError', error)

  return new Promise((res, rej) => {
    resolve = res
    reject = rej
  })

  function read (chunk) {
    json.push(chunk)
  }

  function end () {
    resolve(json.join(''))
  }

  function error (e) {
    reject(e)
  }
}
