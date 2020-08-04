'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _concat = require('./internal/concat');

var _concat2 = _interopRequireDefault(_concat);

var _doSeries = require('./internal/doSeries');

var _doSeries2 = _interopRequireDefault(_doSeries);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/**
 * The same as [`concat`]{@link module:Collections.concat} but runs only a single async operation at a time.
 *
 * @name concatSeries
 * @static
 * @memberOf module:Collections
 * @method
 * @see [async.concat]{@link module:Collections.concat}
 * @category Collection
 * @param {Array|Iterable|Object} coll - A collection to iterate over.
 * @param {AsyncFunction} iteratee - A function to apply to each item in `coll`.
 * The iteratee should complete with an array an array of results.
 * Invoked with (item, callback).
 * @param {Function} [callback(err)] - A callback which is called after all the
 * `iteratee` functions have finished, or an error occurs. Results is an array
 * containing the concatenated results of the `iteratee` function. Invoked with
 * (err, results).
 */
exports.default = (0, _doSeries2.default)(_concat2.default);
module.exports = exports['default'];