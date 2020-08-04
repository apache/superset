'use strict'

const fs = require('fs')
const promise = require('./promise')
const streamify = require('./streamify')

module.exports = write

/**
 * Public function `write`.
 *
 * Returns a promise and asynchronously serialises a data structure to a
 * JSON file on disk. Sanely handles promises, buffers, maps and other
 * iterables.
 *
 * @param path:           Path to the JSON file.
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
function write (path, data, options) {
  const Promise = promise(options)

  return new Promise((resolve, reject) => {
    streamify(data, options)
      .pipe(fs.createWriteStream(path, options))
      .on('finish', () => {
        resolve()
      })
      .on('error', reject)
      .on('dataError', reject)
  })
}
