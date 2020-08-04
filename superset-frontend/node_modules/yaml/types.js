var opt = require('./dist/tags/options')
exports.binaryOptions = opt.binaryOptions
exports.boolOptions = opt.boolOptions
exports.nullOptions = opt.nullOptions
exports.strOptions = opt.strOptions

exports.Schema = require('./dist/schema').default
exports.YAMLMap = require('./dist/schema/Map').default
exports.YAMLSeq = require('./dist/schema/Seq').default
exports.Pair = require('./dist/schema/Pair').default
exports.Scalar = require('./dist/schema/Scalar').default
