var schema = require('protocol-buffers-schema')
var fs = require('fs')
var path = require('path')

var merge = function(a, b) {
  a.messages = a.messages.concat(b.messages)
  a.enums = a.enums.concat(b.enums)
  return a
}

var readSync = function(filename) {
  if (!/\.proto$/i.test(filename) && !fs.existsSync(filename)) filename += '.proto'

  var sch = schema(fs.readFileSync(filename, 'utf-8'))
  var imports = [].concat(sch.imports || [])

  imports.forEach(function(i) {
    sch = merge(sch, readSync(path.resolve(path.dirname(filename), i)))
  })

  return sch
}

var read = function(filename, cb) {
  fs.exists(filename, function(exists) {
    if (!exists && !/\.proto$/i.test(filename)) filename += '.proto'

    fs.readFile(filename, 'utf-8', function(err, proto) {
      if (err) return cb(err)

      var sch = schema(proto)
      var imports = [].concat(sch.imports || [])

      var loop = function() {
        if (!imports.length) return cb(null, sch)

        read(path.resolve(path.dirname(filename), imports.shift()), function(err, ch) {
          if (err) return cb(err)
          sch = merge(sch, ch)
          loop()
        })
      }

      loop()
    })
  })
}

module.exports = read
module.exports.sync = readSync