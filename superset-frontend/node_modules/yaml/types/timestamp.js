'use strict'
Object.defineProperty(exports, '__esModule', { value: true })

var ts = require('../dist/tags/yaml-1.1/timestamp')
exports.default = [ts.intTime, ts.floatTime, ts.timestamp]
exports.floatTime = ts.floatTime
exports.intTime = ts.intTime
exports.timestamp = ts.timestamp

require('../dist/warnings').warnFileDeprecation(__filename)
