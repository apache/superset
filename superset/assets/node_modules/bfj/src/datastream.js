'use strict'

const check = require('check-types')
const BfjStream = require('./stream')
const util = require('util')

util.inherits(DataStream, BfjStream)

module.exports = DataStream

function DataStream (read, options) {
  if (check.not.instanceStrict(this, DataStream)) {
    return new DataStream(read, options)
  }

  return BfjStream.call(this, read, Object.assign({ objectMode: true }, options))
}
