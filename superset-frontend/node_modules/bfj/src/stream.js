'use strict'

const util = require('util')
const Readable = require('stream').Readable
const check = require('check-types')

util.inherits(BfjStream, Readable)

module.exports = BfjStream

function BfjStream (read, options) {
  if (check.not.instanceStrict(this, BfjStream)) {
    return new BfjStream(read)
  }

  check.assert.function(read, 'Invalid read implementation')

  this._read = function () { // eslint-disable-line no-underscore-dangle
    read()
  }

  return Readable.call(this, options)
}
