'use strict'

module.exports = {
  array: 'arr',
  object: 'obj',
  property: 'pro',
  string: 'str',
  number: 'num',
  literal: 'lit',
  endPrefix: 'end-',
  end: 'end',
  error: 'err'
}

module.exports.endArray = module.exports.endPrefix + module.exports.array
module.exports.endObject = module.exports.endPrefix + module.exports.object
module.exports.endLine = `${module.exports.endPrefix}line`
module.exports.dataError = `${module.exports.error}-data`
