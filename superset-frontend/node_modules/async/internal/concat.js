"use strict";

Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.default = concat;
function concat(eachfn, arr, fn, callback) {
    var result = [];
    eachfn(arr, function (x, index, cb) {
        fn(x, function (err, y) {
            result = result.concat(y || []);
            cb(err);
        });
    }, function (err) {
        callback(err, result);
    });
}
module.exports = exports["default"];