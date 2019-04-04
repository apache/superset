var crypto = require('crypto')

if (crypto.randomFillSync) {
  var buffers = { }
  module.exports = function (bytes) {
    var buffer = buffers[bytes]
    if (!buffer) {
      buffer = Buffer.allocUnsafe(bytes)
      if (bytes <= 255) buffers[bytes] = buffer
    }
    return crypto.randomFillSync(buffer)
  }
} else {
  module.exports = crypto.randomBytes
}
