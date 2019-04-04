var crypto = require('crypto')

if (crypto.randomFill) {
  module.exports = function (bytes) {
    return new Promise(function (resolve, reject) {
      crypto.randomFill(Buffer.allocUnsafe(bytes), function (err, buf) {
        if (err) {
          reject(err)
        } else {
          resolve(buf)
        }
      })
    })
  }
} else {
  module.exports = function (bytes) {
    return new Promise(function (resolve, reject) {
      crypto.randomBytes(bytes, function (err, buf) {
        if (err) {
          reject(err)
        } else {
          resolve(buf)
        }
      })
    })
  }
}
