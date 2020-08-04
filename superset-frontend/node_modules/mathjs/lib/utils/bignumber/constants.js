var memoize = require('../function').memoize;

/**
 * Calculate BigNumber e
 * @param {function} BigNumber   BigNumber constructor
 * @returns {BigNumber} Returns e
 */
exports.e = memoize(function (BigNumber) {
  return new BigNumber(1).exp();
}, hasher);

/**
 * Calculate BigNumber golden ratio, phi = (1+sqrt(5))/2
 * @param {function} BigNumber   BigNumber constructor
 * @returns {BigNumber} Returns phi
 */
exports.phi = memoize(function (BigNumber) {
  return new BigNumber(1).plus(new BigNumber(5).sqrt()).div(2);
}, hasher);

/**
 * Calculate BigNumber pi.
 * @param {function} BigNumber   BigNumber constructor
 * @returns {BigNumber} Returns pi
 */
exports.pi = memoize(function (BigNumber) {
  return BigNumber.acos(-1);
}, hasher);

/**
 * Calculate BigNumber tau, tau = 2 * pi
 * @param {function} BigNumber   BigNumber constructor
 * @returns {BigNumber} Returns tau
 */
exports.tau = memoize(function (BigNumber) {
  return exports.pi(BigNumber).times(2);
}, hasher);

/**
 * Create a hash for a BigNumber constructor function. The created has is
 * the configured precision
 * @param {Array} args         Supposed to contain a single entry with
 *                             a BigNumber constructor
 * @return {number} precision
 * @private
 */
function hasher (args) {
  return args[0].precision;
}
