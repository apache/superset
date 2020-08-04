'use strict'

const check = require('check-types')
const BfjStream = require('./stream')
const util = require('util')

util.inherits(JsonStream, BfjStream)

module.exports = JsonStream

function JsonStream (read, options) {
  if (check.not.instanceStrict(this, JsonStream)) {
    return new JsonStream(read, options)
  }

  return BfjStream.call(this, read, Object.assign({ encoding: 'utf8' }, options))
}
