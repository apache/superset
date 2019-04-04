var crypto = self.crypto || self.msCrypto

module.exports = function (bytes) {
  return Promise.resolve(crypto.getRandomValues(new Uint8Array(bytes)))
}
