/**
 * Test whether a value is a BigNumber
 * @param {*} x
 * @return {boolean}
 */
module.exports = function isBigNumber(x) {
  return x && x.constructor.prototype.isBigNumber || false
}
