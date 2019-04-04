'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.default = doSeries;

var _eachOfSeries = require('../eachOfSeries');

var _eachOfSeries2 = _interopRequireDefault(_eachOfSeries);

var _wrapAsync = require('./wrapAsync');

var _wrapAsync2 = _interopRequireDefault(_wrapAsync);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function doSeries(fn) {
    return function (obj, iteratee, callback) {
        return fn(_eachOfSeries2.default, obj, (0, _wrapAsync2.default)(iteratee), callback);
    };
}
module.exports = exports['default'];